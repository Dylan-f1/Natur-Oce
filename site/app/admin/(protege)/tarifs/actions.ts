"use server";

import { redirect } from "next/navigation";
import { remplacerTarifs } from "@/lib/db/tarifs";
import { lancerPublication, type IssuePublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { validerTarifs, type ErreursLigne, type LigneSaisie } from "@/lib/tarifs";

export type EtatTarifs = {
  erreurs?: Record<number, ErreursLigne>;
  general?: string;
  lignes?: LigneSaisie[]; // la saisie, rendue telle quelle en cas d'erreur
  site?: IssuePublication; // enregistré (« Mon accueil » : pas de redirection)
};

/** La liste envoyée par le formulaire (champ caché `lignes`, en JSON), ou null si illisible. */
function lireLignes(donnees: FormData): LigneSaisie[] | null {
  const brut = donnees.get("lignes");
  if (typeof brut !== "string" || brut.length > 20_000) return null;
  try {
    const valeur: unknown = JSON.parse(brut);
    if (!Array.isArray(valeur) || valeur.length > 50) return null;
    const champ = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : null);
    const lignes: LigneSaisie[] = [];
    for (const l of valeur) {
      const o = (l ?? {}) as Record<string, unknown>;
      const ligne = { id: champ(o.id), libelle: champ(o.libelle), duree: champ(o.duree), prix: champ(o.prix) };
      if (Object.values(ligne).some((v) => v === null)) return null;
      lignes.push(ligne as LigneSaisie);
    }
    return lignes;
  } catch {
    return null;
  }
}

/** Enregistre toute la liste des tarifs (EF-12) : tout ou rien, puis republie le site public. */
export async function enregistrerTarifs(_etat: EtatTarifs, donnees: FormData): Promise<EtatTarifs> {
  const retour = await sauverTarifs(donnees);
  if (retour.site) redirect(`/admin/tarifs?enregistre=1&site=${retour.site}`);
  return retour;
}

/** Même enregistrement depuis « Mon accueil » (EF-20) : le panneau se referme au lieu de changer de page. */
export async function enregistrerTarifsAccueil(_etat: EtatTarifs, donnees: FormData): Promise<EtatTarifs> {
  return sauverTarifs(donnees);
}

async function sauverTarifs(donnees: FormData): Promise<EtatTarifs> {
  await exigerSession();

  const lignes = lireLignes(donnees);
  if (!lignes) return { general: "La liste n’a pas pu être lue. Rechargez la page et réessayez." };

  const verdict = validerTarifs(lignes);
  if (!verdict.ok) {
    return {
      erreurs: verdict.erreurs,
      general: verdict.general ?? "Certaines lignes sont à corriger : rien n’a été enregistré.",
      lignes,
    };
  }

  try {
    await remplacerTarifs(verdict.tarifs);
  } catch (erreur) {
    console.error("[tarifs] enregistrement impossible", erreur);
    return { general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.", lignes };
  }
  return { site: await lancerPublication() };
}
