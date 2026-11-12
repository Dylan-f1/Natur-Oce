import { describe, expect, it } from "vitest";
import {
  CLES_TEXTES,
  VALEURS_DEPART,
  lignes,
  normaliser,
  paragraphes,
  sansPointFinal,
  textesDepuisBase,
  validerTextes,
} from "@/lib/textes";

// T14 · Textes de l'accueil modifiables (specs/SPEC-textes.md, EF-19).

const valide = (saisie: Record<string, string>) => validerTextes({ ...VALEURS_DEPART, ...saisie });

describe("normaliser", () => {
  it("unifie les fins de ligne, retire les caractères de contrôle et les espaces de fin", () => {
    expect(normaliser("Un\r\ndeux  \rtrois\u0007", "lignes")).toBe("Un\ndeux\ntrois");
    expect(normaliser("a\tb", "ligne")).toBe("a b");
  });

  it("une ligne : les retours à la ligne deviennent des espaces", () => {
    expect(normaliser("  Google\n Meet  ", "ligne")).toBe("Google Meet");
  });

  it("une ligne par élément : lignes vides et puces retirées", () => {
    expect(normaliser("- La récupération\n\n• Le sommeil\n* Le stress\n", "lignes")).toBe("La récupération\nLe sommeil\nLe stress");
  });

  it("paragraphes : une seule ligne vide entre deux paragraphes", () => {
    expect(normaliser("Premier.\n\n\n\nDeuxième.\n  \nTroisième.", "paragraphes")).toBe("Premier.\n\nDeuxième.\n\nTroisième.");
  });
});

describe("paragraphes, lignes, sansPointFinal", () => {
  it("découpe en paragraphes ; vide → aucun", () => {
    expect(paragraphes("Un.\n\nDeux.")).toEqual(["Un.", "Deux."]);
    expect(paragraphes("   ")).toEqual([]);
  });

  it("découpe en lignes ; vide → aucune", () => {
    expect(lignes("a\n\nb")).toEqual(["a", "b"]);
    expect(lignes("")).toEqual([]);
  });

  it("retire le point final d'une valeur insérée dans une phrase", () => {
    expect(sansPointFinal("1 h 30.")).toBe("1 h 30");
    expect(sansPointFinal("Google Meet")).toBe("Google Meet");
  });
});

describe("validerTextes", () => {
  it("accepte les valeurs de départ et rend les six clés", () => {
    const v = validerTextes(VALEURS_DEPART);
    expect(v.ok).toBe(true);
    expect(Object.keys(v.textes).sort()).toEqual([...CLES_TEXTES].sort());
  });

  it("un champ absent compte comme vide", () => {
    const v = validerTextes({});
    expect(v.ok).toBe(true);
    expect(v.textes.specialite).toBe("");
  });

  it("refuse un texte trop long avec le nombre de caractères en trop", () => {
    const v = valide({ approche: "a".repeat(1512) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.erreurs.approche).toBe("Le texte dépasse 1\u202f500 caractères (12 en trop).");
  });

  it("compte un emoji pour un caractère", () => {
    expect(valide({ outil_visio: "🎥".repeat(40) }).ok).toBe(true);
  });

  it("refuse plus de 6 thèmes, ou un thème de plus de 80 caractères", () => {
    const sept = valide({ themes: "1\n2\n3\n4\n5\n6\n7" });
    expect(sept.ok).toBe(false);
    if (!sept.ok) expect(sept.erreurs.themes).toBe("6 lignes au plus (vous en avez 7).");

    const long = valide({ themes: `Court\n${"x".repeat(81)}` });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.erreurs.themes).toBe("La ligne 2 dépasse 80 caractères (1 en trop).");
  });

  it("signale chaque champ fautif et rend la saisie normalisée pour la réafficher", () => {
    const v = valide({ formation: "f".repeat(161), duree_bilan: "d".repeat(41), specialite: "Gardé.\r\n" });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(Object.keys(v.erreurs).sort()).toEqual(["duree_bilan", "formation"]);
      expect(v.textes.specialite).toBe("Gardé.");
    }
  });
});

describe("textesDepuisBase", () => {
  it("une clé absente prend sa valeur de départ ; une valeur vide reste vide ; une clé inconnue est ignorée", () => {
    const t = textesDepuisBase([
      { cle: "approche", valeur: "Mon parcours." },
      { cle: "specialite", valeur: "" },
      { cle: "inconnue", valeur: "x" },
    ]);
    expect(t.approche).toBe("Mon parcours.");
    expect(t.specialite).toBe("");
    expect(t.themes).toBe(VALEURS_DEPART.themes);
    expect(t).not.toHaveProperty("inconnue");
  });
});
