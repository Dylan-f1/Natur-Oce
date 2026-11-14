// Jeton de confirmation de rendez-vous (T21, specs/SPEC-emails-client.md) : la demande du visiteur
// voyage chiffrée dans le lien envoyé à Océane, rien n'est gardé en base. AES-GCM (chiffré et signé),
// clé dérivée par HKDF du secret du site avec une étiquette propre. Logique pure (Web Crypto),
// testée dans tests/unit/rendezvous.test.ts.

import { parisVersUtc } from "./email/agenda";
import { adresseValide } from "./email/modeles";

export const VALIDITE_JETON_MS = 7 * 24 * 60 * 60 * 1000;
const VERSION = "v1";
const ETIQUETTE = "natur-oce:rendez-vous:v1";

export type Rendezvous = { prenom: string; email: string; jour: string; heure: string };

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

function base64url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisBase64url(texte: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(texte)) return null;
  try {
    const binaire = atob(texte.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const clesDerivees = new Map<string, Promise<CryptoKey>>();

function cleAes(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 32) throw new Error("Secret du jeton absent ou trop court (32 caractères minimum).");
  let cle = clesDerivees.get(secret);
  if (!cle) {
    cle = crypto.subtle
      .importKey("raw", encodeur.encode(secret), "HKDF", false, ["deriveKey"])
      .then((base) =>
        crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: encodeur.encode("natur-oce"), info: encodeur.encode(ETIQUETTE) },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        ),
      );
    clesDerivees.set(secret, cle);
  }
  return cle;
}

/** Jeton : `v1.` + base64url(IV de 12 octets + texte chiffré), expiration comprise dans le chiffré. */
export async function creerJeton(r: Rendezvous, secret: string, maintenant = Date.now()): Promise<string> {
  const contenu = JSON.stringify({ p: r.prenom, e: r.email, j: r.jour, h: r.heure, x: maintenant + VALIDITE_JETON_MS });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cleAes(secret), encodeur.encode(contenu)));
  const tout = new Uint8Array(iv.length + chiffre.length);
  tout.set(iv);
  tout.set(chiffre, iv.length);
  return `${VERSION}.${base64url(tout)}`;
}

export type VerdictJeton = { ok: true; rdv: Rendezvous } | { ok: false; raison: "invalide" | "expire" };

/** Lit un jeton : « invalide » (forme, version, clé, contenu falsifié) ou « expire ». */
export async function lireJeton(jeton: string, secret: string, maintenant = Date.now()): Promise<VerdictJeton> {
  const [version, corps, ...reste] = jeton.split(".");
  if (version !== VERSION || !corps || reste.length > 0 || jeton.length > 4000) return { ok: false, raison: "invalide" };
  const octets = depuisBase64url(corps);
  if (!octets || octets.length < 12 + 16) return { ok: false, raison: "invalide" };
  let clair: string;
  try {
    clair = decodeur.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: octets.slice(0, 12) }, await cleAes(secret), octets.slice(12)));
  } catch {
    return { ok: false, raison: "invalide" };
  }
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(clair) as Record<string, unknown>;
  } catch {
    return { ok: false, raison: "invalide" };
  }
  const { p, e, j, h, x } = v;
  if (
    typeof p !== "string" || p.length > 60 ||
    typeof e !== "string" || !adresseValide(e) ||
    typeof j !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(j) ||
    typeof h !== "string" || !/^\d{2}:\d{2}$/.test(h) ||
    typeof x !== "number"
  ) {
    return { ok: false, raison: "invalide" };
  }
  if (x < maintenant) return { ok: false, raison: "expire" };
  return { ok: true, rdv: { prenom: p, email: e, jour: j, heure: h } };
}

/** Le créneau demandé est déjà passé (heure de Paris) : on ne confirme pas un rendez-vous d'hier. */
export function creneauPasse(jour: string, heure: string, maintenant = Date.now()): boolean {
  return parisVersUtc(jour, heure) < maintenant;
}
