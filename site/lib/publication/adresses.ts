// Instantané des pages publiques (specs/SPEC-publication.md, D-21) : logique pure, testée dans
// tests/unit/publication.test.ts. Sans import : le script scripts/instantane.ts la charge
// directement avec Node, hors de Next.

/** Nom de la balise <meta> qui date l'instantané d'une page (et la distingue d'un rendu du Worker). */
export const MARQUE = "instantane";

/** Ligne d'article telle que lue en base pour l'instantané. */
export type LigneInstantane = { slug: string; statut: string; categorieSlug: string | null };

const SEGMENT = /^[a-z0-9-]{1,90}$/;
const ADRESSE = /^\/(?:[a-z0-9-]{1,90}(?:\/[a-z0-9-]{1,90})*)?$/;

function refuser(adresse: string): never {
  throw new Error(`Adresse refusée pour l'instantané : ${JSON.stringify(adresse)}`);
}

/**
 * Adresses publiques à figer : l'accueil, /conseils, chaque article publié (dans l'ordre reçu) et
 * chaque catégorie qui a au moins un article publié. Les brouillons n'en font jamais partie.
 */
export function adressesPubliques(lignes: readonly LigneInstantane[]): string[] {
  const articles: string[] = [];
  const categories = new Set<string>();
  for (const l of lignes) {
    if (l.statut !== "publie") continue;
    if (!SEGMENT.test(l.slug)) refuser(l.slug);
    articles.push(`/conseils/${l.slug}`);
    if (l.categorieSlug !== null) {
      if (!SEGMENT.test(l.categorieSlug)) refuser(l.categorieSlug);
      categories.add(`/conseils/categorie/${l.categorieSlug}`);
    }
  }
  return ["/", "/conseils", ...articles, ...categories];
}

/**
 * Fichier, relatif au dossier des assets, que Cloudflare sert pour une adresse (règle
 * « auto-trailing-slash » : `/conseils` → `conseils.html`). Toute adresse hors du format attendu
 * est refusée : rien ne peut être écrit hors du dossier.
 */
export function cheminFichier(adresse: string): string {
  if (!ADRESSE.test(adresse)) refuser(adresse);
  return adresse === "/" ? "index.html" : `${adresse.slice(1)}.html`;
}

/** Vérifie qu'une page est complète et ne cite aucune adresse locale (elle casserait en ligne). */
export function verifierHtml(adresse: string, html: string): void {
  if (!/^<!DOCTYPE html>/i.test(html.trimStart()) || !html.trimEnd().endsWith("</html>")) {
    throw new Error(`Page incomplète pour ${adresse}`);
  }
  if (/127\.0\.0\.1|localhost|\[::1\]/i.test(html)) {
    throw new Error(`La page ${adresse} cite une adresse locale : elle ne fonctionnerait pas en ligne`);
  }
}

/** Ajoute `<meta name="instantane" content="<date>">` en tête de <head>. */
export function marquerHtml(html: string, date: string): string {
  if (!html.includes("<head>")) throw new Error("Pas de <head> dans la page : impossible de la dater");
  return html.replace("<head>", `<head><meta name="${MARQUE}" content="${date}">`);
}

// Images (T10, D-22) : chaque image citée par une page figée est figée elle aussi.
const IMAGE = /^\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/;

/** Adresses `/images/<clé>` citées par les balises <img> d'une page, sans doublon. */
export function imagesCitees(html: string): string[] {
  const vues = new Set<string>();
  for (const m of html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)) {
    if (IMAGE.test(m[1])) vues.add(m[1]);
  }
  return [...vues];
}

/**
 * Origine d'où télécharger les images : le site en ligne (https) ou un serveur local de test.
 * Rien d'autre : l'instantané ne doit pas aller chercher de fichiers ailleurs.
 */
export function origineImagesValide(origine: string): boolean {
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/.test(origine) || /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(origine);
}

/** Fichier, relatif au dossier des assets, d'une image du site. */
export function cheminFichierImage(src: string): string {
  if (!IMAGE.test(src)) throw new Error(`Image refusée pour l'instantané : ${JSON.stringify(src)}`);
  return src.slice(1);
}

/**
 * Fichier `_headers` des assets : les images figées gardent un cache d'un an (leur clé n'est
 * jamais réutilisée), comme quand le Worker les sert.
 */
export const ENTETES_STATIQUES = `/images/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
`;
