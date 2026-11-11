// Adresses des articles (specs/SPEC-articles.md, EF-07) : logique pure, testée dans
// tests/unit/articles.test.ts.

const LONGUEUR_MAX = 80;

/** « Récupération & sommeil du sportif ! » → « recuperation-sommeil-du-sportif ». */
export function creerSlug(titre: string): string {
  const slug = titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[œ]/gi, "oe")
    .replace(/[æ]/gi, "ae")
    .toLowerCase()
    .replace(/['’]/g, "-") // « l'effort » → « l-effort »
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "article";
  if (slug.length <= LONGUEUR_MAX) return slug;
  // Coupe à la fin d'un mot, sans tiret final.
  const coupe = slug.slice(0, LONGUEUR_MAX);
  const dernierTiret = coupe.lastIndexOf("-");
  return (dernierTiret > 20 ? coupe.slice(0, dernierTiret) : coupe).replace(/-+$/, "");
}

/** Rend `base` unique parmi `existants` : base, base-2, base-3… */
export function slugUnique(base: string, existants: ReadonlySet<string>): string {
  if (!existants.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidat = `${base}-${i}`;
    if (!existants.has(candidat)) return candidat;
  }
}

/**
 * Adresse à enregistrer. Figée dès la 1re publication (EF-07 : l'adresse d'un article publié ne
 * change plus, même si Océane modifie le titre) ; tant que l'article n'a jamais été publié, elle
 * suit le titre.
 */
export function slugPourEnregistrement(options: {
  titre: string;
  slugActuel: string | null;
  dejaPublie: boolean;
  existants: ReadonlySet<string>;
}): string {
  const { titre, slugActuel, dejaPublie, existants } = options;
  if (dejaPublie && slugActuel) return slugActuel;
  const autres = new Set(existants);
  if (slugActuel) autres.delete(slugActuel); // l'article ne se gêne pas lui-même
  return slugUnique(creerSlug(titre), autres);
}
