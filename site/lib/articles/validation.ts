// Validation des saisies d'Océane (specs/SPEC-articles.md) : logique pure, messages en français
// qui disent quel champ dépasse et de combien.

export const LIMITES = { titre: 90, resume: 160, categorie: 30 } as const;

export type SaisieArticle = { titre: string; resume: string; categorie: string };
export type ErreursArticle = Partial<Record<keyof SaisieArticle, string>>;
export type ResultatValidation =
  | { ok: true; valeurs: SaisieArticle }
  | { ok: false; erreurs: ErreursArticle; valeurs: SaisieArticle };

/** Espaces resserrés, retours à la ligne retirés (titre, résumé, catégorie tiennent sur une ligne). */
function nettoyer(texte: string): string {
  return texte.replace(/\s+/g, " ").trim();
}

function trop(champ: string, longueur: number, max: number): string {
  const ecart = longueur - max;
  return `${champ} dépasse de ${ecart} caractère${ecart > 1 ? "s" : ""} (${max} maximum).`;
}

/**
 * Valide un article. `publier` rend le résumé obligatoire (il sert de description pour Google,
 * ENF-07) ; un brouillon peut rester incomplet, sauf le titre.
 */
export function validerArticle(brut: SaisieArticle, publier: boolean): ResultatValidation {
  const valeurs: SaisieArticle = {
    titre: nettoyer(brut.titre),
    resume: nettoyer(brut.resume),
    categorie: nettoyer(brut.categorie),
  };
  const erreurs: ErreursArticle = {};
  const l = { titre: [...valeurs.titre].length, resume: [...valeurs.resume].length, categorie: [...valeurs.categorie].length };

  if (l.titre === 0) erreurs.titre = "Donnez un titre à l’article.";
  else if (l.titre > LIMITES.titre) erreurs.titre = trop("Le titre", l.titre, LIMITES.titre);

  if (l.resume > LIMITES.resume) erreurs.resume = trop("Le résumé", l.resume, LIMITES.resume);
  else if (publier && l.resume === 0)
    erreurs.resume = "Écrivez un résumé avant de publier : il apparaît dans les résultats de Google.";

  if (l.categorie > LIMITES.categorie) erreurs.categorie = trop("La catégorie", l.categorie, LIMITES.categorie);
  else if (publier && l.categorie === 0) erreurs.categorie = "Choisissez une catégorie avant de publier.";

  return Object.keys(erreurs).length === 0 ? { ok: true, valeurs } : { ok: false, erreurs, valeurs };
}
