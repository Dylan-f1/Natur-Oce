// Réglages d'Océane (T21, specs/SPEC-emails-client.md) : logique pure, testée dans
// tests/unit/reglages.test.ts.

export const CLES_REGLAGES = ["lien_visio", "duree_minutes"] as const;
export type CleReglage = (typeof CLES_REGLAGES)[number];

export const LIEN_VISIO_MAX = 300;
export const DUREE = { min: 15, max: 240, defaut: 60 } as const;

export type Reglages = { lienVisio: string; dureeMinutes: number };
export type ErreursReglages = Partial<Record<"lienVisio" | "dureeMinutes", string>>;
export type VerdictReglages =
  | { ok: true; reglages: { lienVisio: string; dureeMinutes: number } }
  | { ok: false; erreurs: ErreursReglages };

/**
 * Lien de visio accepté : `https:` seulement, un nom de domaine, sans identifiant ni mot de passe,
 * sans espace, 300 caractères au plus. Rend l'adresse normalisée, ou null. Il finit dans un bouton
 * d'e-mail envoyé à un visiteur : rien d'autre qu'une adresse web sûre ne doit passer.
 */
export function lienVisioSur(brut: string): string | null {
  const texte = brut.trim();
  if (texte === "" || texte.length > LIEN_VISIO_MAX || /\s/.test(texte)) return null;
  let url: URL;
  try {
    url = new URL(texte);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
  return url.toString();
}

/** Valide la saisie (tout en texte, comme dans les champs). Un lien vide est permis : pas de visio réglée. */
export function validerReglages(saisie: { lienVisio: string; dureeMinutes: string }): VerdictReglages {
  const erreurs: ErreursReglages = {};
  const brut = saisie.lienVisio.trim();
  let lienVisio = "";
  if (brut !== "") {
    const sur = lienVisioSur(brut);
    if (!sur) erreurs.lienVisio = `Collez l’adresse complète de votre salle de visio, qui commence par https:// (${LIEN_VISIO_MAX} caractères au plus).`;
    else lienVisio = sur;
  }
  const duree = saisie.dureeMinutes.trim();
  const dureeMinutes = /^\d{1,3}$/.test(duree) ? Number(duree) : NaN;
  if (!(dureeMinutes >= DUREE.min && dureeMinutes <= DUREE.max)) {
    erreurs.dureeMinutes = `Durée en minutes, entre ${DUREE.min} et ${DUREE.max} (par exemple 60).`;
  }
  return Object.keys(erreurs).length > 0 ? { ok: false, erreurs } : { ok: true, reglages: { lienVisio, dureeMinutes } };
}

/** Lignes de la table `reglage` → réglages ; valeurs de départ pour ce qui manque ou est invalide. */
export function reglagesDepuisBase(rangees: readonly { cle: string; valeur: string }[]): Reglages {
  const lire = (cle: CleReglage) => rangees.find((r) => r.cle === cle)?.valeur ?? "";
  const duree = Number(lire("duree_minutes"));
  return {
    lienVisio: lienVisioSur(lire("lien_visio")) ?? "",
    dureeMinutes: Number.isInteger(duree) && duree >= DUREE.min && duree <= DUREE.max ? duree : DUREE.defaut,
  };
}
