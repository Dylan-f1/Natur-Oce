import { describe, expect, it } from "vitest";
import {
  ENTETES_STATIQUES,
  MARQUE,
  adressesPubliques,
  cheminFichier,
  cheminFichierImage,
  imagesCitees,
  origineImagesValide,
  marquerHtml,
  verifierHtml,
} from "@/lib/publication/adresses";

// P2 · Instantané des pages publiques (specs/SPEC-publication.md, D-21).

describe("adressesPubliques", () => {
  const lignes = [
    { slug: "bien-dormir", statut: "publie", categorieSlug: "sommeil" },
    { slug: "manger-avant-course", statut: "publie", categorieSlug: "sport" },
    { slug: "plantes-hiver", statut: "publie", categorieSlug: null },
    { slug: "idee-etirements", statut: "brouillon", categorieSlug: "souplesse" },
  ];

  it("liste l'accueil, /conseils, chaque article publié et chaque catégorie ayant un article publié", () => {
    expect(adressesPubliques(lignes)).toEqual([
      "/",
      "/conseils",
      "/conseils/bien-dormir",
      "/conseils/manger-avant-course",
      "/conseils/plantes-hiver",
      "/conseils/categorie/sommeil",
      "/conseils/categorie/sport",
    ]);
  });

  it("exclut les brouillons et les catégories qui n'ont que des brouillons", () => {
    const adresses = adressesPubliques(lignes);
    expect(adresses).not.toContain("/conseils/idee-etirements");
    expect(adresses).not.toContain("/conseils/categorie/souplesse");
  });

  it("sans article : l'accueil et /conseils seulement", () => {
    expect(adressesPubliques([])).toEqual(["/", "/conseils"]);
  });

  it("une catégorie partagée par plusieurs articles n'apparaît qu'une fois", () => {
    const deux = [
      { slug: "a", statut: "publie", categorieSlug: "sport" },
      { slug: "b", statut: "publie", categorieSlug: "sport" },
    ];
    expect(adressesPubliques(deux).filter((a) => a.startsWith("/conseils/categorie/"))).toEqual(["/conseils/categorie/sport"]);
  });

  it("refuse une adresse d'article ou de catégorie hors du format attendu (rien n'est écrit hors du dossier)", () => {
    expect(() => adressesPubliques([{ slug: "../../wrangler", statut: "publie", categorieSlug: null }])).toThrow(/Adresse refusée/);
    expect(() => adressesPubliques([{ slug: "ok", statut: "publie", categorieSlug: "A B" }])).toThrow(/Adresse refusée/);
  });
});

describe("cheminFichier", () => {
  it("donne le fichier que Cloudflare sert pour chaque adresse", () => {
    expect(cheminFichier("/")).toBe("index.html");
    expect(cheminFichier("/conseils")).toBe("conseils.html");
    expect(cheminFichier("/conseils/bien-dormir")).toBe("conseils/bien-dormir.html");
    expect(cheminFichier("/conseils/categorie/sport")).toBe("conseils/categorie/sport.html");
  });

  it("refuse toute adresse qui sortirait du dossier ou contiendrait autre chose que [a-z0-9-]", () => {
    for (const adresse of ["/../x", "/conseils/../../x", "conseils", "/conseils/", "/Conseils", "/a?b", "/a.html", "//x"]) {
      expect(() => cheminFichier(adresse), adresse).toThrow(/Adresse refusée/);
    }
  });
});

describe("verifierHtml", () => {
  const page = '<!DOCTYPE html><html lang="fr"><head><title>Conseils</title></head><body><main>Texte</main></body></html>';

  it("accepte une page complète", () => {
    expect(() => verifierHtml("/conseils", page)).not.toThrow();
  });

  it("refuse une page qui cite une adresse locale (elle casserait en ligne)", () => {
    for (const hote of ["http://127.0.0.1:8793/conseils", "http://localhost:8793/x", "//[::1]:8793"]) {
      expect(() => verifierHtml("/conseils", page.replace("Texte", hote)), hote).toThrow(/adresse locale/);
    }
  });

  it("refuse une page vide ou tronquée", () => {
    expect(() => verifierHtml("/conseils", "")).toThrow(/incomplète/);
    expect(() => verifierHtml("/conseils", page.replace("</html>", ""))).toThrow(/incomplète/);
  });
});

describe("marquerHtml", () => {
  it("ajoute la date de l'instantané dans <head>, une seule fois", () => {
    const html = "<!DOCTYPE html><html><head><title>x</title></head><body></body></html>";
    const marque = marquerHtml(html, "2026-11-11T10:00:00.000Z");
    expect(marque).toContain(`<head><meta name="${MARQUE}" content="2026-11-11T10:00:00.000Z">`);
    expect(marque.match(new RegExp(`name="${MARQUE}"`, "g"))).toHaveLength(1);
  });

  it("échoue s'il n'y a pas de <head>", () => {
    expect(() => marquerHtml("<html><body></body></html>", "2026-11-11T10:00:00.000Z")).toThrow(/<head>/);
  });
});

describe("images de l'instantané (T10)", () => {
  const cle = "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";

  it("relève les images du site citées par la page, une seule fois chacune", () => {
    const html = `<p>x</p><img src="/images/${cle}.webp" alt="a" width="1600" height="900" loading="lazy">` +
      `<img alt="b" src="/images/${cle}.jpg"><img src="/images/${cle}.webp" alt="redite">` +
      `<img src="https://exemple.test/a.webp" alt="c"><img src="/logo-natur-oce-144.webp" alt="logo">` +
      `<img src="/images/../wrangler.webp" alt="d">`;
    expect(imagesCitees(html)).toEqual([`/images/${cle}.webp`, `/images/${cle}.jpg`]);
  });

  it("une page sans image n'en cite aucune", () => {
    expect(imagesCitees("<main><p>Rien</p></main>")).toEqual([]);
  });

  it("chemin du fichier : dans images/, et seulement pour une clé du site", () => {
    expect(cheminFichierImage(`/images/${cle}.webp`)).toBe(`images/${cle}.webp`);
    for (const src of ["/images/../x.webp", "/images/a.webp", `/images/${cle}.png`, `/x/${cle}.webp`]) {
      expect(() => cheminFichierImage(src), src).toThrow(/Image refusée/);
    }
  });

  it("_headers donne aux images figées le même cache d'un an que le Worker", () => {
    expect(ENTETES_STATIQUES).toMatch(/^\/images\/\*\r?\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
  });

  it("images prises sur le site en ligne (https) ou un serveur local de test, rien d'autre", () => {
    expect(origineImagesValide("https://natur-oce.df-dev.workers.dev")).toBe(true);
    expect(origineImagesValide("https://natur-oce.fr")).toBe(true);
    expect(origineImagesValide("http://127.0.0.1:8791")).toBe(true);
    for (const o of ["http://natur-oce.fr", "https://natur-oce.fr/", "file:///etc/passwd", "https://a.b/c", "", "http://10.0.0.1:80"]) {
      expect(origineImagesValide(o), o).toBe(false);
    }
  });
});
