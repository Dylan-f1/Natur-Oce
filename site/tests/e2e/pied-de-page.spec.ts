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

  test("« Confidentialité » mène à la politique de confidentialité, sans aucun cookie pour le visiteur", async ({ page, context }) => {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: "Confidentialité" }).click();
    await expect(page).toHaveURL(/\/confidentialite$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confidentialité");
    for (const titre of ["Qui est responsable", "Le formulaire de demande de séance", "Cookies et mesure d’audience", "Vos droits"]) {
      await expect(page.getByRole("heading", { level: 2, name: titre })).toBeVisible();
    }
    await expect(page.getByRole("main").getByRole("link", { name: "contact@natur-oce.fr" }).first()).toHaveAttribute(
      "href",
      "mailto:contact@natur-oce.fr",
    );
    expect(await context.cookies()).toEqual([]); // ce que la page promet
  });
});
