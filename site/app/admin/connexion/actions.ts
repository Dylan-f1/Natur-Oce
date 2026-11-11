"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/cloudflare";
import { creerAuth, estAutorisee, normaliserAdresse, origineDesEntetes } from "@/lib/auth";
import { cleLimite, compterTentative, ipDuVisiteur } from "@/lib/limite";

const MAX_DEMANDES = 3;
const QUINZE_MINUTES = 15 * 60 * 1000;

/**
 * Demande d'un lien de connexion (specs/SPEC-connexion.md). Le message affiché est le même
 * que l'adresse soit autorisée ou non : seule l'adresse d'Océane reçoit réellement un lien.
 */
export async function demanderLien(donnees: FormData): Promise<void> {
  const email = String(donnees.get("email") ?? "").trim();
  const entetes = await headers();
  let issue = "envoye=1";

  // Limite : 3 demandes par 15 min, par IP et par adresse, comptées pour toute adresse saisie
  // (la réponse ne doit pas différer selon que l'adresse est la bonne ou non).
  const [parIp, parAdresse] = await Promise.all([
    cleLimite("lien-ip", ipDuVisiteur(entetes)),
    cleLimite("lien-adresse", normaliserAdresse(email)),
  ]);
  const sousLaLimite = await Promise.all([
    compterTentative(parIp, MAX_DEMANDES, QUINZE_MINUTES),
    compterTentative(parAdresse, MAX_DEMANDES, QUINZE_MINUTES),
  ]);
  if (sousLaLimite.includes(false)) redirect("/admin/connexion?erreur=trop");

  // Autre adresse : rien n'est écrit en base hors compteur haché (pas même l'adresse saisie,
  // RGPD), rien n'est envoyé, même message. Better Auth garde sa propre barrière (lib/auth).
  if (!estAutorisee(email, (await env()).ADMIN_EMAIL)) redirect(`/admin/connexion?${issue}`);

  try {
    const auth = await creerAuth(origineDesEntetes(entetes));
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/admin", errorCallbackURL: "/admin/connexion" },
      headers: entetes,
    });
  } catch (erreur) {
    if (erreur instanceof APIError && erreur.statusCode === 429) issue = "erreur=trop";
    else if (erreur instanceof APIError && erreur.statusCode === 400) issue = "erreur=adresse";
    else {
      console.error("[connexion] demande de lien impossible", erreur);
      issue = "erreur=technique";
    }
  }

  redirect(`/admin/connexion?${issue}`);
}
