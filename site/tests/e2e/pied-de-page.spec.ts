import { expect, test } from "@playwright/test";

// Pied de page : confidentialité (RGPD) et lien Instagram (EF-13).

test.describe("Pied de page", () => {
  test("le logo Instagram ouvre le compte de Natur’Océ dans un nouvel onglet (EF-13)", async ({ page }) => {
    await page.goto("/");
    const lien = page.locator("footer").getByRole("link", { name: "Instagram de Natur’Océ (nouvel onglet)" });
    await expect(lien).toHaveAttribute("href", "https://www.instagram.com/natur_oce/");
    await expect(lien).toHaveAttribute("target", "_blank");
    await expect(lien).toHaveAttribute("rel", /noopener/);
    await expect(lien.locator("svg")).toBeVisible();
    const boite = await lien.boundingBox();
    expect(boite!.width).toBeGreaterThanOrEqual(44); // cible tactile
    expect(boite!.height).toBeGreaterThanOrEqual(44);
  });

  test("« Confidentialité » ouvre la politique dans une fenêtre, sans quitter la page ; Échap la referme", async ({ page, context }) => {
    await page.goto("/");
    const lien = page.locator("footer").getByRole("link", { name: "Confidentialité" });
    await lien.click();
    await expect(page).toHaveURL(/127\.0\.0\.1:8791\/$/); // on reste sur l'accueil
    const fenetre = page.getByRole("dialog", { name: "Confidentialité" });
    await expect(fenetre).toBeVisible();
    for (const titre of ["Qui est responsable", "Le formulaire de demande de séance", "Cookies et mesure d’audience", "Vos droits"]) {
      await expect(fenetre.getByRole("heading", { level: 3, name: titre })).toBeVisible();
    }
    await expect(fenetre.getByRole("link", { name: "contact@natur-oce.fr" }).first()).toHaveAttribute("href", "mailto:contact@natur-oce.fr");
    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden();
    await expect(lien).toBeFocused();
    expect(await context.cookies()).toEqual([]); // ce que la politique promet
  });

  test("ouverte directement, /confidentialite reste une page entière", async ({ page }) => {
    await page.goto("/confidentialite");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confidentialité");
    await expect(page.getByRole("heading", { level: 2, name: "Vos droits" })).toBeVisible();
  });

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    test("« Confidentialité » mène à la page", async ({ page }) => {
      await page.goto("/");
      await page.locator("footer").getByRole("link", { name: "Confidentialité" }).click();
      await expect(page).toHaveURL(/\/confidentialite$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confidentialité");
    });
  });
});
