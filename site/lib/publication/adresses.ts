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
