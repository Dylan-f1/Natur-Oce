import { origineDesEntetes } from "@/lib/auth";
import { env } from "@/lib/cloudflare";
import { creneauEnLettres } from "@/lib/contact";
import { libererConfirmation, reserverConfirmation } from "@/lib/db/confirmations";
import { lireReglages } from "@/lib/db/reglages";
import { fichierAgenda } from "@/lib/email/agenda";
import { envoyerParMailjet, lireConfigMailjet } from "@/lib/email/mailjet";
import { modeleConfirmationRdv, prenomSur } from "@/lib/email/modeles";
import { cleLimite, compterTentative } from "@/lib/limite";
import { creneauPasse, lireJeton } from "@/lib/rendezvous";

// Océane clique « Envoyer la confirmation » (T21, specs/SPEC-emails-client.md). Seul un POST envoie :
// la page de confirmation, ouverte en GET (même par un contrôle de lien d'Outlook), n'envoie jamais
// rien. Une seule confirmation par lien (réservation atomique, relâchée si Mailjet échoue).

/** Au plus 50 confirmations par jour pour tout le site, comme les accusés (réputation du domaine). */
const CONFIRMATIONS_PAR_JOUR = 50;

export async function POST(requete: Request): Promise<Response> {
  const origine = origineDesEntetes(requete.headers);
  const vers = (jeton: string, erreur?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `${origine}/rendez-vous/confirmer?j=${encodeURIComponent(jeton)}${erreur ? `&erreur=${erreur}` : ""}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "same-origin",
      },
    });

  // Le formulaire du site seulement : une page d'un autre site ne peut pas envoyer de confirmation.
  if (requete.headers.get("origin") !== origine) return new Response("Envoi refusé.", { status: 403 });
  const taille = Number(requete.headers.get("content-length"));
  if (!Number.isFinite(taille) || taille <= 0 || taille > 8_192) return new Response("Demande trop grande.", { status: 413 });

  let jeton = "";
  try {
    const v = (await requete.formData()).get("j");
    jeton = typeof v === "string" ? v : "";
  } catch {
    return new Response("Demande illisible.", { status: 400 });
  }

  const variables = await env();
  const lu = await lireJeton(jeton, variables.BETTER_AUTH_SECRET);
  if (!lu.ok || creneauPasse(lu.rdv.jour, lu.rdv.heure)) return vers(jeton); // la page affiche expiré / passé

  try {
    const reglages = await lireReglages();
    if (!reglages.lienVisio) return vers(jeton); // la page renvoie vers les Réglages
    const config = lireConfigMailjet(variables as unknown as Record<string, unknown>);
    if (!config) return vers(jeton, "envoi");

    const parJour = await compterTentative(
      await cleLimite("confirmation-jour", new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date())),
      CONFIRMATIONS_PAR_JOUR,
      24 * 60 * 60 * 1000,
    );
    if (!parJour) return vers(jeton, "plafond");

    const cle = await cleLimite("confirmation", jeton);
    if (!(await reserverConfirmation(cle))) return vers(jeton); // déjà envoyée : la page le dit, rien ne repart

    const { rdv } = lu;
    const enLettres = creneauEnLettres(rdv.jour, rdv.heure);
    const message = modeleConfirmationRdv(
      { prenom: rdv.prenom, jour: rdv.jour, heure: rdv.heure, dureeMinutes: reglages.dureeMinutes, lienVisio: reglages.lienVisio },
      enLettres,
    );
    const agenda = fichierAgenda({
      jour: rdv.jour,
      heure: rdv.heure,
      dureeMinutes: reglages.dureeMinutes,
      titre: "Séance de naturopathie avec Océane",
      description: `Séance en visio avec Océane (Natur’Océ).\nLien de la visio : ${reglages.lienVisio}`,
      lieu: "Visio",
      url: reglages.lienVisio,
      uid: `confirmation-${cle.slice(0, 24)}`,
    });
    const issue = await envoyerParMailjet(config, {
      destinataire: { email: rdv.email, nom: prenomSur(rdv.prenom) ?? undefined },
      sujet: message.sujet,
      texte: message.texte,
      html: message.html,
      piecesJointes: [{ filename: "seance.ics", type: "text/calendar", content: agenda }],
    });
    if (!issue.ok) {
      console.error("[confirmation] envoi Mailjet impossible :", issue.raison);
      await libererConfirmation(cle); // Océane peut réessayer
      return vers(jeton, "envoi");
    }
    return vers(jeton);
  } catch (erreur) {
    console.error("[confirmation] erreur", erreur);
    return vers(jeton, "envoi");
  }
}
