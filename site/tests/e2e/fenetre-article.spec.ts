import { expect, test } from "@playwright/test";
import { sqlLocal } from "./outils/d1";

// T16 · Article ouvert dans une fenêtre (choix du 12/11, option A).

test.describe.configure({ mode: "serial" });

const ms = (iso: string) => Date.parse(`${iso}T09:00:00Z`);

test.describe("Article dans une fenêtre", () => {
  test.beforeAll(() => {
    sqlLocal(`
      DELETE FROM article; DELETE FROM categorie;
      INSERT INTO categorie (id, nom, slug, cree_le) VALUES ('c-sommeil', 'Sommeil', 'sommeil', 0);
      INSERT INTO article (id, slug, titre, resume, categorie_id, contenu_json, contenu_html, statut, publie_le, cree_le, modifie_le) VALUES
        ('a1', 'bien-dormir', 'Bien dormir après l’effort', 'Trois habitudes.', 'c-sommeil', '{}', '<p>Corps un</p><h2>Intertitre</h2>', 'publie', ${ms("2026-11-01")}, 0, 0),
        ('a2', 'manger-avant-course', 'Manger avant une course', 'La veille.', NULL, '{}', '<p>Corps deux</p>', 'publie', ${ms("2026-11-05")}, 0, 0);
    `);
  });
  test.afterAll(() => sqlLocal("DELETE FROM article; DELETE FROM categorie;"));

  test("depuis l'accueil, un clic ouvre l'article dans une fenêtre, à son adresse ; Échap revient à l'accueil", async ({ page }) => {
    await page.goto("/");
    const planche = page.locator("#conseils .planche").filter({ hasText: "Bien dormir après l’effort" });
    await planche.click();

    const fenetre = page.getByRole("dialog", { name: "Bien dormir après l’effort" });
    await expect(fenetre).toBeVisible();
    await expect(page).toHaveURL(/\/conseils\/bien-dormir$/);
    await expect(fenetre.locator(".corps-article h2")).toHaveText("Intertitre");
    await expect(fenetre.locator(".avert-article")).toContainText("ne remplace pas un avis médical");
    await expect(fenetre.locator(".fil-ariane, .retour-conseils")).toHaveCount(0);
    await expect(page).toHaveTitle("Bien dormir après l’effort · Natur’Océ");

    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveURL(/127\.0\.0\.1:8791\/$/);
    await expect(planche).toBeFocused();
  });

  test("depuis /conseils : « Fermer » et le bouton retour referment ; la page derrière n'a pas bougé", async ({ page }) => {
    await page.goto("/conseils");
    await page.locator(".planche").filter({ hasText: "Manger avant une course" }).click();
    const fenetre = page.getByRole("dialog", { name: "Manger avant une course" });
    await expect(fenetre).toBeVisible();
    await fenetre.getByRole("button", { name: "Fermer" }).click();
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveURL(/\/conseils$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conseils");

    await page.locator(".planche").filter({ hasText: "Manger avant une course" }).click();
    await expect(fenetre).toBeVisible();
    await page.goBack();
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveURL(/\/conseils$/);
  });

  test("« Page entière » mène à la page de l'article", async ({ page }) => {
    await page.goto("/");
    await page.locator("#conseils .planche").filter({ hasText: "Manger avant une course" }).click();
    const fenetre = page.getByRole("dialog", { name: "Manger avant une course" });
    await fenetre.getByRole("link", { name: "Page entière" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Manger avant une course");
  });

  test("sur téléphone, la fenêtre prend tout l'écran", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/conseils");
    await page.locator(".planche").first().click();
    const fenetre = page.getByRole("dialog");
    // Mesurée après l'animation d'ouverture (légère mise à l'échelle).
    await expect.poll(async () => Math.round((await fenetre.boundingBox())!.width)).toBe(375);
  });

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    test("le clic mène à la page de l'article", async ({ page }) => {
      await page.goto("/conseils");
      await page.locator(".planche").filter({ hasText: "Bien dormir après l’effort" }).click();
      await expect(page).toHaveURL(/\/conseils\/bien-dormir$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bien dormir après l’effort");
    });
  });
});
