import { expect, test } from "@playwright/test";
import { sqlLocal } from "./outils/d1";

// T2 · Les tarifs de l'accueil viennent de D1 (EF-03, specs/SPEC-tarifs.md).
// Espace fine insécable entre le montant et « € » (format français d'Intl).
const esp = "[\\u00a0\\u202f ]";

test.describe.configure({ mode: "serial" });

test.describe("Tarifs de l'accueil", () => {
  test.afterAll(() => sqlLocal("DELETE FROM tarif;"));

  test("Given 2 tarifs en base, Then ils s'affichent dans l'ordre, au format français", async ({ page }) => {
    sqlLocal(`
      DELETE FROM tarif;
      INSERT INTO tarif (id, libelle, duree_minutes, prix_centimes, ordre) VALUES
        ('t-suivi', 'Suivi', 45, 6250, 2),
        ('t-bilan', 'Bilan', 90, 7500, 1);
    `);
    await page.goto("/");
    const lignes = page.locator(".tarifs > span");
    await expect(lignes).toHaveCount(2);
    await expect(lignes.nth(0)).toHaveText(new RegExp(`^Bilan \\(1 h 30\\) 75${esp}€$`));
    await expect(lignes.nth(1)).toHaveText(new RegExp(`^Suivi \\(45 min\\) 62,50${esp}€$`));
  });

  test("Given aucun tarif, Then « Tarifs sur demande » s'affiche", async ({ page }) => {
    sqlLocal("DELETE FROM tarif;");
    await page.goto("/");
    await expect(page.locator(".tarifs")).toHaveText("Tarifs sur demande");
  });
});
