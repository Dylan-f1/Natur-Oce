// Empreinte avec clé secrète (HMAC-SHA-256), logique pure testée dans tests/unit/limite.test.ts.
//
// Pourquoi une clé : un SHA-256 simple d'une IPv4 se retrouve par force brute (4 milliards de
// valeurs, quelques secondes), et celui d'une adresse e-mail par dictionnaire. Avec HMAC, le
// calcul exige la clé secrète du site : sans elle, impossible de remonter à l'IP (RGPD).

const encodeur = new TextEncoder();
const clesImportees = new Map<string, Promise<CryptoKey>>();

function cleHmac(secret: string): Promise<CryptoKey> {
  let cle = clesImportees.get(secret);
  if (!cle) {
    cle = crypto.subtle.importKey("raw", encodeur.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    clesImportees.set(secret, cle);
  }
  return cle;
}

/** HMAC-SHA-256 (hex) de `texte` avec `secret`. Refuse un secret absent ou trop court. */
export async function empreinte(texte: string, secret: string): Promise<string> {
  if (!secret || secret.length < 32) throw new Error("Secret d'empreinte absent ou trop court (32 caractères minimum).");
  const signature = await crypto.subtle.sign("HMAC", await cleHmac(secret), encodeur.encode(texte));
  return [...new Uint8Array(signature)].map((o) => o.toString(16).padStart(2, "0")).join("");
}
