import { expect, test } from "@playwright/test";

// T1 · L'accueil servi par le Worker (workerd) répond et porte les garanties déjà validées.
test.describe("Accueil", () => {
  test("répond, en français, non indexé tant qu'il n'y a pas de SIRET (R-02)", async ({ page }) => {
    const reponse = await page.goto("/");
    expect(reponse?.status()).toBe(200);
    await expect(page).toHaveTitle(/Natur’Océ|Natur'Océ/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "La naturopathie, en visio, depuis chez vous.",
    );
  });

  test("une seule action principale : « Demander une séance » partout, qui mène au formulaire", async ({ page }) => {
    await page.goto("/");
    // Depuis T12, le bouton de la section contact est devenu le formulaire lui-même.
    const liens = page.locator("a.bouton");
    await expect(liens).toHaveCount(3);
    for (const lien of await liens.all()) {
      await expect(lien).toHaveText("Demander une séance");
      await expect(lien).toHaveAttribute("href", /#contact$/);
    }
    // Les deux autres : le bouton qui ouvre le formulaire replié (même libellé), puis son envoi.
    await expect(page.locator("button.bouton")).toHaveText(["Demander une séance", "Envoyer ma demande"]);
    await expect(page.locator("#contact form")).toHaveCount(1);
  });

  test("affiche l'avertissement médical près des tarifs et en pied de page (EF-15)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".avert")).toContainText("ne remplace pas un avis médical");
    await expect(page.locator("footer")).toContainText("ne remplace pas un avis médical");
  });

  test("n'appelle aucun service tiers depuis le navigateur (RSE-03)", async ({ page }) => {
    const hotes = new Set<string>();
    page.on("request", (requete) => hotes.add(new URL(requete.url()).host));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect([...hotes]).toEqual(["127.0.0.1:8791"]);
  });

  test("ne défile pas à l'horizontale à 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(375);
  });
});
