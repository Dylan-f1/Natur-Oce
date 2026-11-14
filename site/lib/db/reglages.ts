import { db } from "./index";
import { reglagesDepuisBase, type Reglages } from "@/lib/reglages";
import { reglage } from "./schema";

/** Réglages d'Océane ; une erreur de base est remontée (administration). */
export async function lireReglages(): Promise<Reglages> {
  return reglagesDepuisBase(await (await db()).select({ cle: reglage.cle, valeur: reglage.valeur }).from(reglage));
}

/** Écrit les deux réglages en une transaction D1 : tout ou rien. */
export async function enregistrerReglages(r: Reglages, maintenant = Date.now()): Promise<void> {
  const base = await db();
  await base.batch([
    base.delete(reglage),
    base.insert(reglage).values([
      { cle: "lien_visio", valeur: r.lienVisio, modifieLe: maintenant },
      { cle: "duree_minutes", valeur: String(r.dureeMinutes), modifieLe: maintenant },
    ]),
  ]);
}
