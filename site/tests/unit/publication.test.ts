import { describe, expect, it } from "vitest";
import {
  MARQUE,
  adressesPubliques,
  cheminFichier,
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
