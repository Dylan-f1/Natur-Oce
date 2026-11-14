"use server";

import { enregistrerReglages } from "@/lib/db/reglages";
import { exigerSession } from "@/lib/session";
import { validerReglages, type ErreursReglages } from "@/lib/reglages";

export type EtatReglages = {
  erreurs?: ErreursReglages;
  general?: string;
  valeurs?: { lienVisio: string; dureeMinutes: string }; // la saisie, rendue telle quelle
  enregistre?: boolean;
};

/** Enregistre le lien de visio et la durée d'une séance (T21). Jamais publics : pas de publication. */
export async function enregistrerReglagesAction(_etat: EtatReglages, donnees: FormData): Promise<EtatReglages> {
  await exigerSession();
  const lire = (nom: string) => {
    const v = donnees.get(nom);
    return typeof v === "string" && v.length <= 1_000 ? v : null;
  };
  const lienVisio = lire("lienVisio");
  const dureeMinutes = lire("dureeMinutes");
  if (lienVisio === null || dureeMinutes === null) return { general: "Les réglages n’ont pas pu être lus. Rechargez la page et réessayez." };

  const verdict = validerReglages({ lienVisio, dureeMinutes });
  if (!verdict.ok) {
    return { erreurs: verdict.erreurs, general: "Certains réglages sont à corriger : rien n’a été enregistré.", valeurs: { lienVisio, dureeMinutes } };
  }
  try {
    await enregistrerReglages(verdict.reglages);
  } catch (erreur) {
    console.error("[réglages] enregistrement impossible", erreur);
    return { general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.", valeurs: { lienVisio, dureeMinutes } };
  }
  return { enregistre: true, valeurs: { lienVisio: verdict.reglages.lienVisio, dureeMinutes: String(verdict.reglages.dureeMinutes) } };
}
