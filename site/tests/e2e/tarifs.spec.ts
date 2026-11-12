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
    const lignes = page.locator(".tarifs > li");
    await expect(lignes).toHaveCount(2);
    await expect(lignes.nth(0)).toHaveText(new RegExp(`^Bilan 1 h 30 75${esp}€$`));
    await expect(lignes.nth(1)).toHaveText(new RegExp(`^Suivi 45 min 62,50${esp}€$`));
  });

  test("chaque séance a son étiquette ; sans durée, l'étiquette n'a que le nom et le prix ; un nom long ne déborde pas à 375 px", async ({ page }) => {
    sqlLocal(`
      DELETE FROM tarif;
      INSERT INTO tarif (id, libelle, duree_minutes, prix_centimes, ordre) VALUES
        ('t-long', 'Bilan de vitalité complet avec questionnaire préalable', 120, 9500, 0),
        ('t-forfait', 'Forfait 3 suivis', NULL, 13500, 1);
    `);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const etiquettes = page.getByRole("list", { name: "Tarifs des séances" }).getByRole("listitem");
    await expect(etiquettes).toHaveCount(2);
    await expect(etiquettes.nth(0).locator(".tarif-duree")).toHaveText("2 h");
    await expect(etiquettes.nth(1).locator(".tarif-duree")).toHaveCount(0);
    await expect(etiquettes.nth(1).locator(".tarif-prix")).toHaveText(new RegExp(`^135${esp}€$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test("Given aucun tarif, Then « Tarifs sur demande » s'affiche", async ({ page }) => {
    sqlLocal("DELETE FROM tarif;");
    await page.goto("/");
    await expect(page.locator(".tarifs")).toHaveText("Tarifs sur demande");
  });
});
