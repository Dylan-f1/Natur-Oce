// Sections ajoutées par Océane à l'accueil (specs/SPEC-edition-visuelle.md, EF-21, D-24) :
// logique pure, testée dans tests/unit/sections.test.ts. Texte brut seulement.

import { cleImageValide } from "./images";
import { lignes, normaliser, paragraphes } from "./textes";

/** Sections d'origine après lesquelles Océane peut ajouter les siennes, dans l'ordre de la page. */
export const EMPLACEMENTS = ["stress", "approche", "seances", "conseils"] as const;
export type Emplacement = (typeof EMPLACEMENTS)[number];

/** Identifiants déjà pris par l'accueil : une ancre de section ajoutée ne doit pas les reprendre. */
const ANCRES_PRISES = new Set(["sport", "stress", "approche", "seances", "conseils", "contact", "formulaire-contact"]);

export const MODELES = {
  texte: { libelle: "Texte simple", aide: "Un titre et des paragraphes, comme « Mon approche »." },
  texte_liste: { libelle: "Texte + liste", aide: "Un titre, un paragraphe et une liste de thèmes, comme « Ma spécialité »." },
  texte_photo: { libelle: "Texte + photo", aide: "Un titre, des paragraphes et une photo, avec sa description." },
} as const;
export type ModeleSection = keyof typeof MODELES;

export const SECTIONS_MAX = 8;
export const LIMITES_SECTION = { titre: 80, texte: { texte: 1500, texte_liste: 800, texte_photo: 1200 }, ligne: 80, lignes: 6, description: 200 } as const;

export type SaisieSection = { titre: string; texte: string; liste: string; bouton: boolean; imageCle: string | null; imageAlt: string | null };
export type SectionValide = SaisieSection & { modele: ModeleSection };
export type ErreursSection = Partial<Record<"titre" | "texte" | "liste" | "image" | "imageAlt", string>>;
export type VerdictSection = { ok: true; section: SectionValide } | { ok: false; erreurs: ErreursSection };

const longueur = (t: string) => [...t].length;
const nombre = new Intl.NumberFormat("fr-FR");
const enTrop = (quoi: string, max: number, n: number) =>
  `${quoi} dépasse ${nombre.format(max)} caractères (${nombre.format(n - max)} en trop).`;

export function estModele(v: unknown): v is ModeleSection {
  return v === "texte" || v === "texte_liste" || v === "texte_photo";
}

export function estEmplacement(v: unknown): v is Emplacement {
  return (EMPLACEMENTS as readonly unknown[]).includes(v);
}

/** Valide une section selon son modèle ; rien n'est écrit si un champ est fautif. */
export function validerSection(modele: ModeleSection, saisie: Partial<Record<string, unknown>>): VerdictSection {
  const brut = (cle: string) => (typeof saisie[cle] === "string" ? (saisie[cle] as string).slice(0, 20_000) : "");
  const titre = normaliser(brut("titre"), "ligne");
  const texte = normaliser(brut("texte"), "paragraphes");
  const liste = modele === "texte_liste" ? normaliser(brut("liste"), "lignes") : "";
  const bouton = modele === "texte_liste" && saisie.bouton === true;
  const photo = modele === "texte_photo";
  const imageCle = photo && typeof saisie.imageCle === "string" && cleImageValide(saisie.imageCle) ? saisie.imageCle : null;
  const imageAlt = photo ? normaliser(brut("imageAlt"), "ligne") : "";
  const erreurs: ErreursSection = {};

  if (titre === "") erreurs.titre = "Donnez un titre à cette section.";
  else if (longueur(titre) > LIMITES_SECTION.titre) erreurs.titre = enTrop("Le titre", LIMITES_SECTION.titre, longueur(titre));

  const maxTexte = LIMITES_SECTION.texte[modele];
  if (modele !== "texte_liste" && texte === "") erreurs.texte = "Écrivez le texte de cette section.";
  else if (longueur(texte) > maxTexte) erreurs.texte = enTrop("Le texte", maxTexte, longueur(texte));

  if (modele === "texte_liste") {
    const elements = lignes(liste);
    const trop = elements.findIndex((l) => longueur(l) > LIMITES_SECTION.ligne);
    if (elements.length === 0) erreurs.liste = "Ajoutez au moins un thème, un par ligne.";
    else if (elements.length > LIMITES_SECTION.lignes) erreurs.liste = `${LIMITES_SECTION.lignes} lignes au plus (vous en avez ${elements.length}).`;
    else if (trop >= 0) erreurs.liste = enTrop(`La ligne ${trop + 1}`, LIMITES_SECTION.ligne, longueur(elements[trop]));
  }

  if (photo) {
    if (!imageCle) erreurs.image = "Choisissez une photo.";
    if (imageAlt === "") erreurs.imageAlt = "Décrivez la photo : sans description, la section n’est pas enregistrée.";
    else if (longueur(imageAlt) > LIMITES_SECTION.description) erreurs.imageAlt = enTrop("La description", LIMITES_SECTION.description, longueur(imageAlt));
  }

  return Object.keys(erreurs).length > 0
    ? { ok: false, erreurs }
    : { ok: true, section: { modele, titre, texte, liste, bouton, imageCle, imageAlt: photo ? imageAlt : null } };
}

/** « Mes conseils de saison » → « mes-conseils-de-saison » ; jamais une ancre déjà prise. */
export function ancres(titres: readonly string[]): string[] {
  const vues = new Set(ANCRES_PRISES);
  return titres.map((titre) => {
    const base =
      titre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/, "") || "section";
    let ancre = base;
    for (let n = 2; vues.has(ancre); n++) ancre = `${base}-${n}`;
    vues.add(ancre);
    return ancre;
  });
}

export type Place = { id: string; apres: string; ordre: number };

/** Sections dans l'ordre de la page : par emplacement, puis par rang. */
export function trier<T extends Place>(sections: readonly T[]): T[] {
  const rang = (a: string) => {
    const i = (EMPLACEMENTS as readonly string[]).indexOf(a);
    return i < 0 ? EMPLACEMENTS.length : i;
  };
  return [...sections].sort((a, b) => rang(a.apres) - rang(b.apres) || a.ordre - b.ordre);
}

/**
 * Monte ou descend une section d'un cran dans l'ordre de la page : elle passe devant (ou derrière)
 * sa voisine, ou change d'emplacement si elle est en bout. Renvoie les nouvelles places, renumérotées,
 * ou null si elle est déjà tout en haut ou tout en bas.
 */
export function deplacer(sections: readonly Place[], id: string, sens: -1 | 1): Place[] | null {
  const ordonnees = trier(sections).map((s) => ({ id: s.id, apres: s.apres, ordre: s.ordre }));
  const i = ordonnees.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const s = ordonnees[i];
  const voisine = ordonnees[i + sens];
  if (voisine && voisine.apres === s.apres) {
    [s.ordre, voisine.ordre] = [voisine.ordre, s.ordre];
  } else {
    // En bout de son emplacement : elle passe derrière (ou devant) la section d'origine voisine,
    // au bout le plus proche de sa place d'avant.
    const e = (EMPLACEMENTS as readonly string[]).indexOf(s.apres) + sens;
    if (e < 0 || e >= EMPLACEMENTS.length) return null;
    s.apres = EMPLACEMENTS[e];
    s.ordre = sens === -1 ? Number.MAX_SAFE_INTEGER : -1;
  }
  const rangs = new Map<string, number>();
  return trier(ordonnees).map((x) => {
    const r = rangs.get(x.apres) ?? 0;
    rangs.set(x.apres, r + 1);
    return { ...x, ordre: r };
  });
}

/** Pour l'affichage : paragraphes et thèmes d'une section. */
export function contenuSection(s: { texte: string; liste: string }) {
  return { paragraphes: paragraphes(s.texte), themes: lignes(s.liste) };
}
