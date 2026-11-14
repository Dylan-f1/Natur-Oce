import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { limite } from "./schema";

// Réservation d'une confirmation de rendez-vous (T21) : une seule confirmation par lien, même si
// Océane clique deux fois. Table `limite`, clé = empreinte HMAC du jeton (lib/limite.ts cleLimite),
// jamais de donnée personnelle. Gardée 8 jours, un peu plus que la validité du lien (7 jours).

export const RESERVATION_MS = 8 * 24 * 60 * 60 * 1000;

/** Réserve : vrai seulement pour l'appel qui crée la ligne (INSERT … ON CONFLICT DO NOTHING). */
export async function reserverConfirmation(cle: string, maintenant = Date.now()): Promise<boolean> {
  const base = await db();
  await base.delete(limite).where(sql`${limite.finFenetre} < ${maintenant}`);
  const ligne = await base
    .insert(limite)
    .values({ cle, compteur: 1, finFenetre: maintenant + RESERVATION_MS })
    .onConflictDoNothing()
    .returning({ cle: limite.cle })
    .get();
  return ligne !== undefined;
}

/** Relâche la réservation (l'envoi a échoué : Océane doit pouvoir réessayer). */
export async function libererConfirmation(cle: string): Promise<void> {
  await (await db()).delete(limite).where(eq(limite.cle, cle));
}

/** Lecture seule, pour afficher « déjà envoyée » sans rien réserver. */
export async function confirmationReservee(cle: string, maintenant = Date.now()): Promise<boolean> {
  const ligne = await (await db()).select({ fin: limite.finFenetre }).from(limite).where(eq(limite.cle, cle)).get();
  return ligne !== undefined && ligne.fin >= maintenant;
}
