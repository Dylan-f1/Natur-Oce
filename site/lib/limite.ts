import { sql } from "drizzle-orm";
import { env } from "@/lib/cloudflare";
import { db } from "@/lib/db";
import { limite } from "@/lib/db/schema";
import { empreinte } from "@/lib/empreinte";

// Limites du site (specs/SPEC-connexion.md, specs/SPEC-contact.md) : fenêtre fixe par clé.

/**
 * Clé d'une limite : HMAC de l'usage (« lien-ip », « contact-ip ») et de la valeur (IP).
 * La clé secrète est celle des sessions (BETTER_AUTH_SECRET) : la base ne permet jamais de
 * retrouver une IP sans elle.
 */
export async function cleLimite(usage: string, valeur: string): Promise<string> {
  return empreinte(`natur-oce:limite:${usage}:${valeur}`, (await env()).BETTER_AUTH_SECRET);
}

/**
 * Compte une tentative et dit si elle reste sous la limite (`max` par `fenetreMs`).
 * Une seule requête SQL atomique (D1 n'a pas de transaction interactive) ; les compteurs
 * expirés sont purgés au passage.
 */
export async function compterTentative(cle: string, max: number, fenetreMs: number): Promise<boolean> {
  const maintenant = Date.now();
  const base = await db();
  await base.delete(limite).where(sql`${limite.finFenetre} < ${maintenant}`);
  const ligne = await base
    .insert(limite)
    .values({ cle, compteur: 1, finFenetre: maintenant + fenetreMs })
    .onConflictDoUpdate({
      target: limite.cle,
      set: { compteur: sql`${limite.compteur} + 1` },
    })
    .returning({ compteur: limite.compteur })
    .get();
  return (ligne?.compteur ?? 1) <= max;
}

/** IP du visiteur derrière Cloudflare (en local : « local »). */
export function ipDuVisiteur(entetes: Headers): string {
  return (
    entetes.get("cf-connecting-ip") ?? entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  );
}
