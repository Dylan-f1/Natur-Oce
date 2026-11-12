"use server";

import { redirect } from "next/navigation";
import { remplacerTextes } from "@/lib/db/textes";
import { lancerPublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { CLES_TEXTES, validerTextes, type ErreursTextes, type Textes } from "@/lib/textes";

export type EtatTextes = {
  erreurs?: ErreursTextes;
  general?: string;
  textes?: Textes; // la saisie, rendue telle quelle en cas d'erreur
};

/** Enregistre les six textes de l'accueil (EF-19) : tout ou rien, puis republie le site public. */
export async function enregistrerTextes(_etat: EtatTextes, donnees: FormData): Promise<EtatTextes> {
  await exigerSession();

  const saisie: Record<string, string> = {};
  for (const cle of CLES_TEXTES) {
    const v = donnees.get(cle);
    if (typeof v !== "string" || v.length > 20_000) {
      return { general: "Les textes n’ont pas pu être lus. Rechargez la page et réessayez." };
    }
    saisie[cle] = v;
  }

  const verdict = validerTextes(saisie);
  if (!verdict.ok) {
    return { erreurs: verdict.erreurs, general: "Certains textes sont à raccourcir : rien n’a été enregistré.", textes: verdict.textes };
  }

  try {
    await remplacerTextes(verdict.textes);
  } catch (erreur) {
    console.error("[textes] enregistrement impossible", erreur);
    return { general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.", textes: verdict.textes };
  }
  redirect(`/admin/textes?enregistre=1&site=${await lancerPublication()}`);
}
