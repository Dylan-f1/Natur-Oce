import { describe, expect, it } from "vitest";
import { ancres, deplacer, estEmplacement, estModele, trier, validerSection } from "@/lib/sections";

// T18 · Sections ajoutées par Océane (specs/SPEC-edition-visuelle.md, EF-21).

describe("validerSection", () => {
  it("texte simple : titre et texte obligatoires, normalisés", () => {
    const v = validerSection("texte", { titre: "  Mes  conseils ", texte: "Un.\n\n\n\nDeux." });
    expect(v).toEqual({ ok: true, section: { modele: "texte", titre: "Mes conseils", texte: "Un.\n\nDeux.", liste: "", bouton: false } });
    const vide = validerSection("texte", { titre: "", texte: "" });
    expect(vide.ok).toBe(false);
    if (!vide.ok) expect(Object.keys(vide.erreurs).sort()).toEqual(["texte", "titre"]);
  });

  it("texte + liste : au moins un thème, 6 au plus, bouton facultatif ; texte facultatif", () => {
    const v = validerSection("texte_liste", { titre: "Ateliers", texte: "", liste: "- Sommeil\n\nRespiration", bouton: true });
    expect(v).toEqual({ ok: true, section: { modele: "texte_liste", titre: "Ateliers", texte: "", liste: "Sommeil\nRespiration", bouton: true } });
    const sans = validerSection("texte_liste", { titre: "Ateliers", liste: "" });
    expect(sans.ok).toBe(false);
    if (!sans.ok) expect(sans.erreurs.liste).toBe("Ajoutez au moins un thème, un par ligne.");
    const trop = validerSection("texte_liste", { titre: "Ateliers", liste: "1\n2\n3\n4\n5\n6\n7" });
    if (!trop.ok) expect(trop.erreurs.liste).toBe("6 lignes au plus (vous en avez 7).");
  });

  it("limites : titre 80, texte 1 500 (simple) ou 800 (avec liste), nombre de caractères en trop", () => {
    const t = validerSection("texte", { titre: "t".repeat(81), texte: "x".repeat(1501) });
    expect(t.ok).toBe(false);
    if (!t.ok) {
      expect(t.erreurs.titre).toBe("Le titre dépasse 80 caractères (1 en trop).");
      expect(t.erreurs.texte).toMatch(/^Le texte dépasse 1.500 caractères \(1 en trop\)\.$/);
    }
    const l = validerSection("texte_liste", { titre: "a", texte: "x".repeat(801), liste: "a" });
    if (!l.ok) expect(l.erreurs.texte).toBe("Le texte dépasse 800 caractères (1 en trop).");
  });

  it("le bouton n'existe qu'avec une liste ; seul true l'active", () => {
    const v = validerSection("texte", { titre: "a", texte: "b", bouton: true });
    expect(v.ok && v.section.bouton).toBe(false);
    const w = validerSection("texte_liste", { titre: "a", liste: "b", bouton: "true" });
    expect(w.ok && w.section.bouton).toBe(false);
  });
});

describe("garde-fous", () => {
  it("modèles et emplacements connus seulement", () => {
    expect(estModele("texte")).toBe(true);
    expect(estModele("texte_photo")).toBe(false); // T19
    expect(estEmplacement("approche")).toBe(true);
    expect(estEmplacement("contact")).toBe(false);
  });
});

describe("ancres", () => {
  it("dérivent du titre, sans accents, uniques, jamais une ancre de l'accueil", () => {
    expect(ancres(["Mes conseils d’été", "Mes conseils d'été", "Approche", "!!!"])).toEqual([
      "mes-conseils-d-ete",
      "mes-conseils-d-ete-2",
      "approche-2",
      "section",
    ]);
  });
});

describe("trier et deplacer", () => {
  const places = [
    { id: "c", apres: "seances", ordre: 0 },
    { id: "a", apres: "stress", ordre: 0 },
    { id: "b", apres: "stress", ordre: 1 },
  ];

  it("trie par emplacement puis par rang", () => {
    expect(trier(places).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("monter : passe devant sa voisine du même emplacement", () => {
    expect(deplacer(places, "b", -1)).toEqual([
      { id: "b", apres: "stress", ordre: 0 },
      { id: "a", apres: "stress", ordre: 1 },
      { id: "c", apres: "seances", ordre: 0 },
    ]);
  });

  it("en bout d'emplacement : passe de l'autre côté de la section d'origine voisine", () => {
    expect(deplacer(places, "b", 1)).toEqual([
      { id: "a", apres: "stress", ordre: 0 },
      { id: "b", apres: "approche", ordre: 0 },
      { id: "c", apres: "seances", ordre: 0 },
    ]);
    expect(deplacer(places, "c", -1)).toEqual([
      { id: "a", apres: "stress", ordre: 0 },
      { id: "b", apres: "stress", ordre: 1 },
      { id: "c", apres: "approche", ordre: 0 },
    ]);
  });

  it("tout en haut (après le stress) ou tout en bas (après les conseils) : rien ne bouge", () => {
    expect(deplacer(places, "a", -1)).toBeNull();
    expect(deplacer([{ id: "z", apres: "conseils", ordre: 0 }], "z", 1)).toBeNull();
    expect(deplacer(places, "inconnu", 1)).toBeNull();
  });
});
