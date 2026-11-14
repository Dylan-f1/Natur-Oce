import { origineDesEntetes } from "@/lib/auth";
import { env } from "@/lib/cloudflare";
import { LIMITE_ENVOIS, TAILLE_MAX_DEMANDE, validerDemande, type ErreursContact } from "@/lib/contact";
import { envoyerAOceane } from "@/lib/email";
import { envoyerAccuse } from "@/lib/email/client";
import { lireConfigMailjet } from "@/lib/email/mailjet";
import { creerJeton } from "@/lib/rendezvous";
import { modeleDemandeSeance } from "@/lib/email/modeles";
import { cleLimite, compterTentative, ipDuVisiteur } from "@/lib/limite";

// Demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, RSE-04). L'accueil est un fichier
// statique (D-21) : le formulaire est envoyé ici. Avec JavaScript, réponse JSON ; sans, redirection
// vers une page de confirmation ou d'échec. Aucune demande n'est gardée par le site.

type Reponse = { ok: true } | { ok: false; erreurs?: ErreursContact; general?: string };

const ECHEC_ENVOI = "L’envoi a échoué. Réessayez, ou écrivez à contact@natur-oce.fr.";
const TROP = "Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.";

export async function POST(requete: Request): Promise<Response> {
  const enJson = (requete.headers.get("accept") ?? "").includes("application/json");
  const origine = origineDesEntetes(requete.headers);

  const repondre = (statut: number, corps: Reponse): Response => {
    if (enJson) return Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
    // Sans JavaScript : le navigateur a déjà contrôlé les champs ; reste le succès ou l'échec.
    return new Response(null, {
      status: 303,
      headers: { Location: `${origine}/contact/${corps.ok ? "envoyee" : "non-envoyee"}`, "Cache-Control": "no-store" },
    });
  };

  // Le formulaire du site seulement : une page d'un autre site ne peut pas s'en servir.
  if (requete.headers.get("origin") !== origine) {
    return Response.json({ ok: false, general: "Envoi refusé." }, { status: 403 });
  }

  // Taille annoncée vérifiée avant toute lecture : un corps démesuré ne coûte rien au Worker.
  const taille = Number(requete.headers.get("content-length"));
  if (!Number.isFinite(taille) || taille <= 0 || taille > TAILLE_MAX_DEMANDE) {
    return repondre(413, { ok: false, general: ECHEC_ENVOI });
  }

  let donnees: FormData;
  try {
    donnees = await requete.formData();
  } catch {
    return repondre(400, { ok: false, general: ECHEC_ENVOI });
  }
  const champ = (nom: string) => {
    const v = donnees.get(nom);
    return typeof v === "string" ? v.slice(0, 5_000) : "";
  };

  const verdict = validerDemande({
    prenom: champ("prenom"),
    email: champ("email"),
    jour: champ("jour"),
    heure: champ("heure"),
    message: champ("message"),
    site: champ("site"),
  });
  // Robot : même réponse qu'un envoi réussi, mais rien ne part (ENF-04).
  if (verdict.statut === "robot") return repondre(200, { ok: true });
  if (verdict.statut === "invalide") return repondre(422, { ok: false, erreurs: verdict.erreurs });

  const sousLaLimite = await compterTentative(
    await cleLimite("contact-ip", ipDuVisiteur(requete.headers)),
    LIMITE_ENVOIS.max,
    LIMITE_ENVOIS.fenetreMs,
  );
  if (!sousLaLimite) return repondre(429, { ok: false, general: TROP });

  // Lien chiffré « Confirmer ce créneau » (T21) : seulement avec un créneau, et si Mailjet est branché
  // (sinon la page ne pourrait rien envoyer). Un échec ici garde le bouton de réponse pré-écrite.
  let lienConfirmation: string | undefined;
  try {
    const variables = await env();
    const { demande } = verdict;
    if (demande.creneau && lireConfigMailjet(variables as unknown as Record<string, unknown>)) {
      const jeton = await creerJeton({ prenom: demande.prenom, email: demande.email, ...demande.creneau }, variables.BETTER_AUTH_SECRET);
      lienConfirmation = `${origine}/rendez-vous/confirmer?j=${jeton}`;
    }
  } catch (erreur) {
    console.error("[contact] lien de confirmation impossible", erreur);
  }

  try {
    await envoyerAOceane(modeleDemandeSeance({ ...verdict.demande, lienConfirmation }));
  } catch {
    return repondre(502, { ok: false, general: ECHEC_ENVOI }); // déjà journalisé par lib/email
  }
  // Accusé de réception au visiteur (EF-05, T20) : au mieux, ne change jamais la réponse.
  await envoyerAccuse(verdict.demande);
  return repondre(200, { ok: true });
}
