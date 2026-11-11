// Lien de connexion de secours (specs/SPEC-connexion.md, R-15) : si l'e-mail n'arrive pas, Dylan
// crée en ligne de commande (scripts/lien-secours.ts) un lien identique à ceux de Better Auth.
// Règles relevées dans better-auth 1.7.18 (plugins/magic-link) : jeton de 32 lettres, stocké
// « magic-link:<SHA-256 base64url> » (storeToken « hashed »), usage unique, durée = expiresIn.
// Logique pure, testée dans tests/unit/lien-secours.test.ts. Importée par Node : extensions .ts.

import { normaliserAdresse, origineDeConfiance } from "./regles.ts";

/** Même durée que les liens envoyés par e-mail (lib/auth/index.ts, magicLink expiresIn). */
export const DUREE_SECONDES = 600;

const LETTRES = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 32 lettres tirées sans biais (octets ≥ 208 rejetés : 208 = 4 × 52). */
export function jetonAleatoire(
  aleatoire: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  let jeton = "";
  while (jeton.length < 32) {
    for (const octet of aleatoire(64)) {
      if (octet < 208) jeton += LETTRES[octet % 52];
      if (jeton.length === 32) break;
    }
  }
  return jeton;
}

function base64url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Identifiant rangé dans la table `verification` : jamais le jeton lui-même. */
export async function identifiantStocke(jeton: string): Promise<string> {
  const empreinte = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return `magic-link:${base64url(new Uint8Array(empreinte))}`;
}

export type LigneVerification = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
};

export async function ligneVerification(options: {
  jeton: string;
  email: string;
  maintenant: number;
  id: string;
}): Promise<LigneVerification> {
  const email = normaliserAdresse(options.email);
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(email)) throw new Error("Cette adresse n'est pas une adresse e-mail.");
  return {
    id: options.id,
    identifier: await identifiantStocke(options.jeton),
    value: JSON.stringify({ type: "magic-link", email, name: "" }),
    expiresAt: options.maintenant + DUREE_SECONDES * 1000,
    createdAt: options.maintenant,
    updatedAt: options.maintenant,
  };
}

const texteSql = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** Instruction SQL pour `wrangler d1 execute --file` (valeurs échappées). */
export function sqlInsertion(l: LigneVerification): string {
  return (
    "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (" +
    [texteSql(l.id), texteSql(l.identifier), texteSql(l.value), l.expiresAt, l.createdAt, l.updatedAt].join(", ") +
    ");"
  );
}

/** Même lien que ceux envoyés par e-mail (app/admin/connexion/actions.ts). */
export function urlLienSecours(origine: string, jeton: string): string {
  const url = new URL("/api/auth/magic-link/verify", origine);
  url.searchParams.set("token", jeton);
  url.searchParams.set("callbackURL", "/admin");
  url.searchParams.set("errorCallbackURL", "/admin/connexion");
  return url.toString();
}

/** Origine du site acceptée par la connexion (mêmes règles que lib/auth/regles.ts). */
export function origineAcceptee(origine: string): boolean {
  try {
    const url = new URL(origine);
    if (url.origin !== origine) return false; // pas de chemin, de barre finale ni d'identifiants
    return origineDeConfiance(url.host, url.protocol.replace(":", "")) === origine;
  } catch {
    return false;
  }
}
