// Textes de l'accueil modifiables par Océane (specs/SPEC-textes.md, EF-19, D-23) : logique pure,
// testée dans tests/unit/textes.test.ts. Texte brut seulement : React l'échappe à l'affichage.

export const CLES_TEXTES = [
  "specialite",
  "themes",
  "stress",
  "themes_stress",
  "approche",
  "formation",
  "outil_visio",
  "duree_bilan",
] as const;
export type CleTexte = (typeof CLES_TEXTES)[number];
export type Textes = Record<CleTexte, string>;

/** « paragraphes » : une ligne vide sépare deux paragraphes ; « lignes » : un élément par ligne. */
type Forme = "paragraphes" | "lignes" | "ligne";

type Champ = {
  section: string;
  libelle: string;
  aide: string;
  forme: Forme;
  max: number; // caractères (par ligne pour « lignes »)
  maxLignes?: number;
};

export const CHAMPS_TEXTES: Record<CleTexte, Champ> = {
  specialite: {
    section: "Ma spécialité : les sportifs",
    libelle: "Votre texte sur l’accompagnement des sportifs",
    aide: "Laissez une ligne vide entre deux paragraphes.",
    forme: "paragraphes",
    max: 800,
  },
  themes: {
    section: "Ma spécialité : les sportifs",
    libelle: "Ce que l’on travaille ensemble",
    aide: "Un thème par ligne, 6 au plus.",
    forme: "lignes",
    max: 80,
    maxLignes: 6,
  },
  stress: {
    section: "Ma spécialité : la gestion du stress",
    libelle: "Votre texte sur la gestion du stress",
    aide: "Laissez une ligne vide entre deux paragraphes.",
    forme: "paragraphes",
    max: 800,
  },
  themes_stress: {
    section: "Ma spécialité : la gestion du stress",
    libelle: "Ce que l’on travaille ensemble (stress)",
    aide: "Un thème par ligne, 6 au plus.",
    forme: "lignes",
    max: 80,
    maxLignes: 6,
  },
  approche: {
    section: "Mon approche",
    libelle: "Votre présentation et votre parcours",
    aide: "Laissez une ligne vide entre deux paragraphes.",
    forme: "paragraphes",
    max: 1500,
  },
  formation: {
    section: "Mon approche",
    libelle: "Votre formation",
    aide: "Par exemple : Formée à la naturopathie de 2020 à 2023, à l’école …",
    forme: "ligne",
    max: 160,
  },
  outil_visio: {
    section: "Une séance, étape par étape",
    libelle: "Outil de visio",
    aide: "Par exemple : Google Meet. Affiché après « Je vous réponds par mail avec un lien de visio ».",
    forme: "ligne",
    max: 40,
  },
  duree_bilan: {
    section: "Une séance, étape par étape",
    libelle: "Durée du bilan",
    aide: "Par exemple : 1 h 30. Affiché après « Durée ».",
    forme: "ligne",
    max: 40,
  },
};

/** Valeurs tant qu'Océane n'a rien enregistré : les phrases de la maquette validée, sinon vide. */
export const VALEURS_DEPART: Textes = {
  specialite:
    "Que vous prépariez une course ou que vous repreniez le sport, on adapte votre hygiène de vie à votre entraînement.",
  themes: ["L’alimentation autour de l’entraînement", "La récupération", "La préparation d’une saison ou d’une course"].join("\n"),
  // Brouillon du 12/11 pour la section ajoutée à la demande de Dylan : à remplacer par Océane.
  stress:
    "Rythme soutenu, sommeil en pointillé, tensions qui s’installent : on regarde ensemble votre hygiène de vie pour retrouver de l’équilibre au quotidien.",
  themes_stress: ["Le sommeil", "L’alimentation au quotidien", "Les temps de pause et de respiration"].join("\n"),
  approche: "",
  formation: "Formée à la naturopathie de 2020 à 2023.",
  outil_visio: "",
  duree_bilan: "",
};

const longueur = (texte: string) => [...texte].length; // un emoji compte pour un caractère
const nombre = new Intl.NumberFormat("fr-FR");

/** Puces tapées par habitude en début de ligne (« - », « • », « * »). */
const PUCE = /^[-•*–]\s+/;

/**
 * Texte saisi → texte rangé : fins de ligne unifiées, caractères de contrôle et espaces de fin de
 * ligne retirés ; selon la forme, une seule ligne, une ligne par élément ou des paragraphes séparés
 * par une seule ligne vide.
 */
export function normaliser(brut: string, forme: Forme): string {
  const texte = brut
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B\u2028\u2029]/g, (c) => (c === "\t" ? " " : ""))
    .split("\n")
    .map((l) => l.replace(/[ \u00a0]+$/g, ""))
    .join("\n")
    .trim();
  if (forme === "ligne") return texte.replace(/\s+/g, " ");
  if (forme === "lignes") {
    return texte
      .split("\n")
      .map((l) => l.trim().replace(PUCE, "").trim())
      .filter((l) => l !== "")
      .join("\n");
  }
  return paragraphes(texte).join("\n\n");
}

/** Paragraphes à afficher (vide → aucun). */
export function paragraphes(valeur: string): string[] {
  return valeur
    .split(/\n[ \t\u00a0]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/** Éléments d'une liste « une ligne par élément » (vide → aucun). */
export function lignes(valeur: string): string[] {
  return valeur
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

/** Une ligne insérée dans une phrase qui a déjà son point : « 1 h 30. » → « 1 h 30 ». */
export function sansPointFinal(valeur: string): string {
  return valeur.replace(/[\s.]+$/, "");
}

export type ErreursTextes = Partial<Record<CleTexte, string>>;
export type VerdictTextes = { ok: true; textes: Textes } | { ok: false; erreurs: ErreursTextes; textes: Textes };

function enTrop(max: number, n: number, quoi: string): string {
  return `${quoi} dépasse ${nombre.format(max)} caractères (${nombre.format(n - max)} en trop).`;
}

/**
 * Valide les six textes : soit tout est bon et rendu prêt à écrire, soit chaque champ fautif est
 * signalé et rien ne doit être écrit. Un champ absent de la saisie compte comme vide.
 */
export function validerTextes(saisie: Partial<Record<string, unknown>>): VerdictTextes {
  const textes = {} as Textes;
  const erreurs: ErreursTextes = {};

  for (const cle of CLES_TEXTES) {
    const champ = CHAMPS_TEXTES[cle];
    const brut = typeof saisie[cle] === "string" ? (saisie[cle] as string) : "";
    const valeur = normaliser(brut.slice(0, 20_000), champ.forme);
    textes[cle] = valeur;

    if (champ.forme === "lignes") {
      const elements = lignes(valeur);
      const trop = elements.findIndex((l) => longueur(l) > champ.max);
      if (champ.maxLignes && elements.length > champ.maxLignes) {
        erreurs[cle] = `${champ.maxLignes} lignes au plus (vous en avez ${elements.length}).`;
      } else if (trop >= 0) {
        erreurs[cle] = enTrop(champ.max, longueur(elements[trop]), `La ligne ${trop + 1}`);
      }
    } else if (longueur(valeur) > champ.max) {
      erreurs[cle] = enTrop(champ.max, longueur(valeur), "Le texte");
    }
  }

  return Object.keys(erreurs).length > 0 ? { ok: false, erreurs, textes } : { ok: true, textes };
}

/** Lignes de la table `texte` → les six textes ; une clé absente prend sa valeur de départ. */
export function textesDepuisBase(rangees: readonly { cle: string; valeur: string }[]): Textes {
  const textes: Textes = { ...VALEURS_DEPART };
  for (const r of rangees) {
    if ((CLES_TEXTES as readonly string[]).includes(r.cle)) textes[r.cle as CleTexte] = r.valeur;
  }
  return textes;
}
