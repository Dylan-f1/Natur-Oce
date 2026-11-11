import { expect, test } from "@playwright/test";
import { sqlLocal } from "./outils/d1";

// T8 · Pages publiques des conseils (specs/SPEC-articles.md, EF-06, EF-07, EF-15, ENF-07).

test.describe.configure({ mode: "serial" });

const ms = (iso: string) => Date.parse(`${iso}T09:00:00Z`);

function semerArticles() {
  sqlLocal(`
    DELETE FROM article; DELETE FROM categorie;
    INSERT INTO categorie (id, nom, slug, cree_le) VALUES ('c-sommeil', 'Sommeil', 'sommeil', 0), ('c-sport', 'Sport', 'sport', 0);
    INSERT INTO article (id, slug, titre, resume, categorie_id, contenu_json, contenu_html, statut, publie_le, cree_le, modifie_le) VALUES
      ('a1', 'bien-dormir', 'Bien dormir après l’effort', 'Trois habitudes pour récupérer la nuit.', 'c-sommeil', '{}', '<p>Corps un</p><h2>Intertitre</h2>', 'publie', ${ms("2026-11-01")}, 0, 0),
      ('a2', 'manger-avant-course', 'Manger avant une course', 'Quoi manger la veille et le matin.', 'c-sport', '{}', '<p>Corps deux</p>', 'publie', ${ms("2026-11-05")}, 0, 0),
      ('a3', 'brouillon-cache', 'Brouillon caché', '', NULL, '{}', '<p>secret</p>', 'brouillon', NULL, 0, 0),
      ('a4', 'ancien-conseil', 'Ancien conseil', 'Un plus ancien.', NULL, '{}', '<p>Corps quatre</p>', 'publie', ${ms("2026-10-01")}, 0, 0),
      ('a5', 'plus-ancien', 'Le plus ancien', 'Le tout premier.', 'c-sommeil', '{}', '<p>Corps cinq</p>', 'publie', ${ms("2026-09-01")}, 0, 0);
  `);
}

test.describe("Conseils publics", () => {
  test.beforeAll(semerArticles);
  test.afterAll(() => sqlLocal("DELETE FROM article; DELETE FROM categorie;"));

  test("Given des articles publiés, /conseils les liste du plus récent au plus ancien, avec titre, date et catégorie, sans les brouillons (EF-06)", async ({ page }) => {
    await page.goto("/conseils");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conseils");
    const titres = await page.locator(".planche h3").allTextContents();
    expect(titres).toEqual(["Manger avant une course", "Bien dormir après l’effort", "Ancien conseil", "Le plus ancien"]);
    const premiere = page.locator(".planche").first();
    await expect(premiere.locator(".categorie")).toHaveText("Sport");
    await expect(premiere.locator("time")).toHaveText("5 novembre 2026");
    await expect(page.getByText("Brouillon caché")).toHaveCount(0);
  });

  test("Given un article publié, sa page affiche le titre, le contenu et l'avertissement médical (EF-07, EF-15)", async ({ page }) => {
    await page.goto("/conseils");
    await page.getByRole("link", { name: /Bien dormir après l’effort/ }).click();
    await expect(page).toHaveURL(/\/conseils\/bien-dormir$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bien dormir après l’effort");
    await expect(page.locator(".corps-article h2")).toHaveText("Intertitre");
    await expect(page.locator(".avert-article")).toBeVisible();
    await expect(page.locator(".avert-article")).toContainText("ne remplace pas un avis médical");
  });

  test("chaque article a un titre et une description uniques, et une adresse canonique (ENF-07)", async ({ page }) => {
    const vus = [];
    for (const slug of ["bien-dormir", "manger-avant-course"]) {
      await page.goto(`/conseils/${slug}`);
      const titre = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      const canonique = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonique).toMatch(new RegExp(`/conseils/${slug}$`));
      vus.push({ titre, description });
    }
    expect(vus[0].titre).toBe("Bien dormir après l’effort · Natur’Océ");
    expect(vus[0].description).toBe("Trois habitudes pour récupérer la nuit.");
    expect(vus[0].titre).not.toBe(vus[1].titre);
    expect(vus[0].description).not.toBe(vus[1].description);
  });

  test("un brouillon, une adresse inconnue ou mal formée répondent 404", async ({ request }) => {
    for (const adresse of ["/conseils/brouillon-cache", "/conseils/inconnu", "/conseils/Majuscules", "/conseils/a%27b"]) {
      expect((await request.get(adresse)).status(), adresse).toBe(404);
    }
  });

  test("l'accueil montre les 3 derniers articles et mène à leur page", async ({ page }) => {
    await page.goto("/");
    const titres = await page.locator("#conseils .planche h3").allTextContents();
    expect(titres).toEqual(["Manger avant une course", "Bien dormir après l’effort", "Ancien conseil"]);
    await page.locator("#conseils .planche").first().click();
    await expect(page).toHaveURL(/\/conseils\/manger-avant-course$/);
  });

  test("sans article publié, l'accueil et /conseils l'annoncent simplement", async ({ page }) => {
    sqlLocal("DELETE FROM article;");
    await page.goto("/");
    await expect(page.getByText("Les premiers conseils arrivent bientôt.")).toBeVisible();
    await expect(page.locator("#conseils").getByRole("link", { name: "Tous les articles" })).toBeHidden();
    await page.goto("/conseils");
    await expect(page.getByText("Les premiers conseils arrivent bientôt.")).toBeVisible();
  });
});
