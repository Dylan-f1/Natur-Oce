import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { limite } from "@/lib/db/schema";

// Limites du site (specs/SPEC-connexion.md, specs/SPEC-contact.md) : fenêtre fixe par clé.

/** Empreinte SHA-256 (hex) : la base ne garde jamais l'IP ni l'adresse en clair. */
export async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((o) => o.toString(16).padStart(2, "0")).join("");
}

/** Clé d'une limite : usage (« lien », « contact ») + valeur (IP, adresse normalisée). */
export async function cleLimite(usage: string, valeur: string): Promise<string> {
  return empreinte(`natur-oce:${usage}:${valeur}`);
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
