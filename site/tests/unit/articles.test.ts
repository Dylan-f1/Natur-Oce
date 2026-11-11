import { describe, expect, it } from "vitest";
import { lienSur, rendreArticle, texteBrut } from "@/lib/articles/rendu";
import { creerSlug, slugPourEnregistrement, slugUnique } from "@/lib/articles/slug";
import { LIMITES, validerArticle } from "@/lib/articles/validation";

// Petits constructeurs de JSON Tiptap pour garder les tests lisibles.
const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const lien = (href: unknown) => ({ type: "link", attrs: { href } });

describe("rendreArticle — ce qui doit sortir (D-20)", () => {
  it("1. paragraphe simple", () => {
    expect(rendreArticle(doc(p(t("Bonjour"))))).toBe("<p>Bonjour</p>");
  });
  it("2. gras et italique", () => {
    expect(rendreArticle(doc(p(t("fort", [{ type: "bold" }, { type: "italic" }]))))).toBe(
      "<p><strong><em>fort</em></strong></p>",
    );
  });
  it("3. intertitres : h1 et h2 → h2, h3 à h6 → h3", () => {
    const h = (level: number) => ({ type: "heading", attrs: { level }, content: [t("Titre")] });
    expect(rendreArticle(doc(h(1), h(2), h(3), h(5)))).toBe("<h2>Titre</h2><h2>Titre</h2><h3>Titre</h3><h3>Titre</h3>");
  });
  it("4. listes à puces et numérotées (départ conservé)", () => {
    const li = (s: string) => ({ type: "listItem", content: [p(t(s))] });
    expect(rendreArticle(doc({ type: "bulletList", content: [li("a"), li("b")] }))).toBe(
      "<ul><li><p>a</p></li><li><p>b</p></li></ul>",
    );
    expect(rendreArticle(doc({ type: "orderedList", attrs: { start: 3 }, content: [li("c")] }))).toBe(
      '<ol start="3"><li><p>c</p></li></ol>',
    );
  });
  it("5. citation et saut de ligne", () => {
    expect(rendreArticle(doc({ type: "blockquote", content: [p(t("a"), { type: "hardBreak" }, t("b"))] }))).toBe(
      "<blockquote><p>a<br>b</p></blockquote>",
    );
  });
  it("6. lien interne et lien externe (rel ajouté)", () => {
    expect(rendreArticle(doc(p(t("ici", [lien("/conseils/sommeil")]))))).toBe('<p><a href="/conseils/sommeil">ici</a></p>');
    expect(rendreArticle(doc(p(t("source", [lien("https://www.anses.fr/fr")]))))).toBe(
      '<p><a href="https://www.anses.fr/fr" rel="noopener noreferrer">source</a></p>',
    );
  });
  it("7. image du site avec description, dimensions, chargement différé", () => {
    const img = { type: "image", attrs: { src: "/images/articles/3f2a.webp", alt: "Bol de légumes", width: 1600, height: 1067 } };
    expect(rendreArticle(doc(img))).toBe(
      '<img src="/images/articles/3f2a.webp" alt="Bol de légumes" width="1600" height="1067" loading="lazy" decoding="async">',
    );
  });
  it("8. paragraphes vides ignorés", () => {
    expect(rendreArticle(doc(p(), p(t("")), p(t("x"))))).toBe("<p>x</p>");
  });
});

describe("rendreArticle — tentatives d'injection, toutes neutralisées", () => {
  it("9. balise <script> dans le texte → échappée", () => {
    expect(rendreArticle(doc(p(t('<script>alert("x")</script>'))))).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });
  it("10. lien javascript: → texte sans lien", () => {
    expect(rendreArticle(doc(p(t("clic", [lien("javascript:alert(1)")]))))).toBe("<p>clic</p>");
  });
  it("11. lien javascript: déguisé (casse, espaces, tabulation) → refusé", () => {
    for (const href of [" JavaScript:alert(1)", "java\tscript:alert(1)", "jav&#x61;script:alert(1)"]) {
      expect(rendreArticle(doc(p(t("x", [lien(href)]))))).toBe("<p>x</p>");
    }
  });
  it("12. lien data: et vbscript: → refusés", () => {
    expect(lienSur("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(lienSur("vbscript:msgbox(1)")).toBeNull();
  });
  it("13. guillemet dans l'adresse d'un lien → échappé, pas d'attribut injecté", () => {
    const html = rendreArticle(doc(p(t("x", [lien('https://exemple.fr/" onmouseover="alert(1)')]))));
    expect(html).not.toMatch(/"\s*onmouseover=/);
    expect(html).toContain("%22");
  });
  it("14. attributs on… et HTML brut dans les attrs → ignorés", () => {
    const html = rendreArticle(doc({ type: "paragraph", attrs: { onclick: "alert(1)", style: "x" }, content: [t("ok")] }));
    expect(html).toBe("<p>ok</p>");
  });
  it("15. image externe, chemin remontant ou sans description → retirée", () => {
    const img = (src: string, alt = "desc") => ({ type: "image", attrs: { src, alt } });
    expect(rendreArticle(doc(img("https://pirate.example/x.webp")))).toBe("");
    expect(rendreArticle(doc(img("/images/../admin.webp")))).toBe("");
    expect(rendreArticle(doc(img("/images/a.svg")))).toBe("");
    expect(rendreArticle(doc(img("/images/a.webp", "  ")))).toBe("");
  });
  it("16. texte alternatif piégé → échappé", () => {
    const html = rendreArticle(doc({ type: "image", attrs: { src: "/images/a.webp", alt: '"><script>x</script>' } }));
    expect(html).toContain('alt="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });
  it("17. nœuds inconnus (iframe, code, html) → ignorés avec leur contenu", () => {
    expect(rendreArticle(doc({ type: "iframe", attrs: { src: "https://pirate.example" } }, { type: "html", content: [t("<b>x</b>")] }, p(t("fin"))))).toBe(
      "<p>fin</p>",
    );
  });
  it("18. lien avec identifiants (https://natur-oce.fr@pirate.example) → refusé", () => {
    expect(lienSur("https://natur-oce.fr@pirate.example/")).toBeNull();
    expect(lienSur("//pirate.example")).toBeNull();
  });
  it("19. imbrication excessive → coupée, sans plantage", () => {
    let n: unknown = p(t("fond"));
    for (let i = 0; i < 500; i++) n = { type: "blockquote", content: [n] };
    expect(() => rendreArticle(doc(n))).not.toThrow();
    expect(rendreArticle(doc(n))).not.toContain("fond");
  });
  it("20. entrées invalides → chaîne vide", () => {
    for (const entree of [null, undefined, "texte", 42, [], { type: "paragraph" }, { type: "doc", content: "x" }]) {
      expect(rendreArticle(entree)).toBe("");
    }
  });
});

describe("texteBrut", () => {
  it("assemble le texte sans balise et le coupe proprement", () => {
    const d = doc(p(t("Bien")), p(t("dormir", [{ type: "bold" }])));
    expect(texteBrut(d)).toBe("Bien dormir");
    expect(texteBrut(doc(p(t("a".repeat(400)))), 50)).toHaveLength(50);
  });
});

describe("slug (EF-07)", () => {
  it.each([
    ["Récupération & sommeil du sportif !", "recuperation-sommeil-du-sportif"],
    ["Préparer l’effort : 5 conseils", "preparer-l-effort-5-conseils"],
    ["Œufs, cœur et bœuf", "oeufs-coeur-et-boeuf"],
    ["   ", "article"],
    ["!!!", "article"],
  ])("« %s » → %s", (titre, attendu) => {
    expect(creerSlug(titre)).toBe(attendu);
  });

  it("coupe les titres longs à 80 caractères en fin de mot", () => {
    const s = creerSlug("Comment adapter son alimentation pendant une préparation marathon quand on travaille en horaires décalés");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });

  it("ajoute -2, -3… pour les doublons", () => {
    expect(slugUnique("sommeil", new Set(["sommeil", "sommeil-2"]))).toBe("sommeil-3");
  });

  it("figé après publication, même si le titre change", () => {
    expect(
      slugPourEnregistrement({ titre: "Nouveau titre", slugActuel: "ancien-titre", dejaPublie: true, existants: new Set(["ancien-titre"]) }),
    ).toBe("ancien-titre");
  });

  it("suit le titre tant que l'article n'a jamais été publié, sans se gêner lui-même", () => {
    expect(
      slugPourEnregistrement({ titre: "Sommeil", slugActuel: "sommeil", dejaPublie: false, existants: new Set(["sommeil"]) }),
    ).toBe("sommeil");
    expect(
      slugPourEnregistrement({ titre: "Nouveau", slugActuel: "brouillon", dejaPublie: false, existants: new Set(["brouillon"]) }),
    ).toBe("nouveau");
  });
});

describe("validerArticle", () => {
  const ok = { titre: "Bien dormir", resume: "Trois habitudes simples.", categorie: "Sommeil" };

  it("accepte une saisie correcte et resserre les espaces", () => {
    const r = validerArticle({ ...ok, titre: "  Bien\n dormir  " }, true);
    expect(r.ok).toBe(true);
    expect(r.valeurs.titre).toBe("Bien dormir");
  });

  it("dit quel champ dépasse et de combien", () => {
    const r = validerArticle({ ...ok, titre: "a".repeat(LIMITES.titre + 12) }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.titre).toBe("Le titre dépasse de 12 caractères (90 maximum).");
  });

  it("compte les caractères accentués et les emojis comme un seul", () => {
    expect(validerArticle({ ...ok, titre: "é".repeat(90) }, true).ok).toBe(true);
    expect(validerArticle({ ...ok, titre: "🌿".repeat(90) }, true).ok).toBe(true);
  });

  it("exige un titre, même pour un brouillon", () => {
    const r = validerArticle({ titre: " ", resume: "", categorie: "" }, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erreurs)).toEqual(["titre"]);
  });

  it("exige résumé et catégorie pour publier, pas pour un brouillon", () => {
    expect(validerArticle({ ...ok, resume: "", categorie: "" }, false).ok).toBe(true);
    const r = validerArticle({ ...ok, resume: "", categorie: "" }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreurs.resume).toMatch(/Google/);
      expect(r.erreurs.categorie).toMatch(/catégorie/);
    }
  });

  it("garde la saisie en cas d'erreur (rien n'est perdu)", () => {
    const r = validerArticle({ ...ok, resume: "r".repeat(200) }, true);
    expect(r.ok).toBe(false);
    expect(r.valeurs.resume).toHaveLength(200);
  });
});
