import { asc } from "drizzle-orm";
import { db } from "./index";
import type { TarifValide } from "@/lib/tarifs";
import { tarif, type Tarif } from "./schema";

/**
 * Tarifs dans l'ordre choisi par Océane. En cas d'erreur de base, renvoie une liste vide
 * (l'accueil affiche alors « Tarifs sur demande ») et journalise l'erreur : la page d'accueil
 * ne doit jamais tomber à cause des tarifs.
 */
export async function listerTarifs(): Promise<Tarif[]> {
  try {
    return await (await db()).select().from(tarif).orderBy(asc(tarif.ordre), asc(tarif.libelle));
  } catch (erreur) {
    console.error("[tarifs] lecture D1 impossible", erreur);
    return [];
  }
}

/**
 * Remplace toute la liste par celle validée par `validerTarifs` (T11, EF-12), en une seule
 * transaction D1 : soit tout est écrit, soit rien.
 */
export async function remplacerTarifs(tarifs: readonly TarifValide[]): Promise<void> {
  const base = await db();
  const effacer = base.delete(tarif);
  if (tarifs.length === 0) {
    await effacer;
    return;
  }
  await base.batch([effacer, base.insert(tarif).values([...tarifs])]);
}
