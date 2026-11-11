// Images des articles (specs/SPEC-images.md, EF-11, D-22) : logique pure, testée dans
// tests/unit/images.test.ts. Utilisée par le navigateur (avant l'envoi) et par le serveur
// (à la réception, sans jamais croire ce que le navigateur annonce).

/** Plafond avant réduction : ce qu'Océane peut choisir sur son téléphone ou son ordinateur. */
export const TAILLE_MAX_NAVIGATEUR = 10 * 1024 * 1024;
/** Plafond après réduction, à la réception : une valeur D1 en ligne est limitée à ≈ 2 Mo. */
export const TAILLE_MAX_SERVEUR = 1_500_000;
/** Largeur visée par la réduction dans le navigateur. */
export const LARGEUR_MAX = 1600;
/** Au-delà, ce n'est pas une image réduite par le site (même limite que le rendu des articles). */
const DIMENSION_MAX = 4000;

const TYPES_CHOISIS = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export type AnalyseImage =
  | { ok: true; type: "image/webp" | "image/jpeg"; extension: "webp" | "jpg"; largeur: number; hauteur: number }
  | { ok: false; raison: string };

const CLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/;

/** Clé d'image fabriquée par le site : `<uuid>.webp` ou `<uuid>.jpg`. */
export function cleImageValide(cle: string): boolean {
  return CLE.test(cle);
}

/** Message à afficher si le fichier choisi ne convient pas, ou null. */
export function verifierFichierChoisi(fichier: { size: number; type: string }): string | null {
  if (!TYPES_CHOISIS.has(fichier.type)) {
    return "Ce fichier n’est pas une image acceptée. Formats possibles : JPEG, PNG, WebP ou HEIC, 10 Mo au plus.";
  }
  if (fichier.size > TAILLE_MAX_NAVIGATEUR) {
    return "Cette image pèse plus de 10 Mo. Choisissez une photo plus légère (JPEG, PNG, WebP ou HEIC).";
  }
  return null;
}

const refus = (raison: string): AnalyseImage => ({ ok: false, raison });

function ascii(o: Uint8Array, debut: number, texte: string): boolean {
  for (let i = 0; i < texte.length; i++) if (o[debut + i] !== texte.charCodeAt(i)) return false;
  return true;
}

function dimensions(largeur: number, hauteur: number, type: "image/webp" | "image/jpeg"): AnalyseImage {
  if (largeur < 1 || hauteur < 1 || largeur > DIMENSION_MAX || hauteur > DIMENSION_MAX) {
    return refus("Dimensions de l’image impossibles");
  }
  return { ok: true, type, extension: type === "image/webp" ? "webp" : "jpg", largeur, hauteur };
}

function analyserWebp(o: Uint8Array): AnalyseImage {
  if (o.length < 21) return refus("Image WebP tronquée");
  const tailleRiff = o[4] | (o[5] << 8) | (o[6] << 16) | (o[7] << 24);
  if (tailleRiff < 0 || 8 + tailleRiff > o.length) return refus("Image WebP tronquée");

  if (ascii(o, 12, "VP8 ")) {
    if (o.length < 30) return refus("Image WebP tronquée");
    if (o[23] !== 0x9d || o[24] !== 0x01 || o[25] !== 0x2a) return refus("Image WebP invalide");
    return dimensions((o[26] | (o[27] << 8)) & 0x3fff, (o[28] | (o[29] << 8)) & 0x3fff, "image/webp");
  }
  if (ascii(o, 12, "VP8L")) {
    if (o.length < 25) return refus("Image WebP tronquée");
    if (o[20] !== 0x2f) return refus("Image WebP invalide");
    const largeur = 1 + (((o[22] & 0x3f) << 8) | o[21]);
    const hauteur = 1 + (((o[24] & 0x0f) << 10) | (o[23] << 2) | ((o[22] & 0xc0) >> 6));
    return dimensions(largeur, hauteur, "image/webp");
  }
  if (ascii(o, 12, "VP8X")) {
    if (o.length < 30) return refus("Image WebP tronquée");
    return dimensions(1 + (o[24] | (o[25] << 8) | (o[26] << 16)), 1 + (o[27] | (o[28] << 8) | (o[29] << 16)), "image/webp");
  }
  return refus("Image WebP d’un type inconnu");
}

// Marqueurs JPEG qui portent les dimensions (SOF), hors DHT (C4), JPG (C8) et DAC (CC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function analyserJpeg(o: Uint8Array): AnalyseImage {
  let i = 2;
  while (i + 3 < o.length) {
    if (o[i] !== 0xff) return refus("Image JPEG invalide");
    const marqueur = o[i + 1];
    if (marqueur === 0xff) { i++; continue; } // octets de remplissage
    if (marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { i += 2; continue; } // sans longueur
    if (marqueur === 0xda || marqueur === 0xd9) break; // début des données ou fin : pas de SOF trouvé
    const longueur = (o[i + 2] << 8) | o[i + 3];
    if (longueur < 2) return refus("Image JPEG invalide");
    if (SOF.has(marqueur)) {
      if (i + 8 >= o.length) break;
      return dimensions((o[i + 7] << 8) | o[i + 8], (o[i + 5] << 8) | o[i + 6], "image/jpeg");
    }
    i += 2 + longueur;
  }
  return refus("Image JPEG tronquée ou sans dimensions");
}

/**
 * Reconnaît un WebP ou un JPEG par sa signature et lit ses dimensions dans le fichier. Tout
 * autre contenu (PNG, SVG, HTML déguisé…) est refusé.
 */
export function analyserImage(octets: Uint8Array): AnalyseImage {
  if (octets.length > TAILLE_MAX_SERVEUR) return refus("L’image réduite dépasse 1,5 Mo");
  if (octets.length >= 12 && ascii(octets, 0, "RIFF") && ascii(octets, 8, "WEBP")) return analyserWebp(octets);
  if (octets.length >= 4 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return analyserJpeg(octets);
  return refus("Ce fichier n’est ni un WebP ni un JPEG");
}
