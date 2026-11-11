import { asc } from "drizzle-orm";
import { db } from "./index";
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
