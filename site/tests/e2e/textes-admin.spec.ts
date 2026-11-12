import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";
import { appelsPublication, reinitialiserGithub } from "./outils/github";

// T14 · Textes de l'accueil modifiables (specs/SPEC-textes.md, EF-19).

test.describe.configure({ mode: "serial" });

const enBase = () => lignesLocales<{ cle: string; valeur: string }>("SELECT cle, valeur FROM texte ORDER BY cle");
const valeurEnBase = (cle: string) => enBase().find((l) => l.cle === cle)?.valeur;

async function ouvrirTextes(page: Page) {
  await seConnecter(page);
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Textes" }).click();
  await expect(page).toHaveURL(/\/admin\/textes$/);
}

test.describe("Textes de l'accueil", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(async () => {
    sqlLocal("DELETE FROM texte;");
    await reinitialiserGithub();
  });
  test.afterAll(async () => {
    viderComptes();
    sqlLocal("DELETE FROM texte;");
    await reinitialiserGithub();
  });

  test("sans texte enregistré : valeurs de départ, et aucune marque « À FOURNIR » sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).not.toContainText("FOURNIR");
    await expect(page.locator("#sport")).toContainText("Que vous prépariez une course");
    await expect(page.locator(".sport-themes li")).toHaveCount(3);
    await expect(page.locator("#approche")).toContainText("Formée à la naturopathie de 2020 à 2023.");
    await expect(page.locator("#seances")).toContainText("Je vous réponds par mail avec un lien de visio.");
    await expect(page.locator("#seances")).not.toContainText("Durée");

    await ouvrirTextes(page);
    await expect(page.getByLabel("Votre texte sur l’accompagnement des sportifs")).toHaveValue(/^Que vous prépariez/);
    await expect(page.getByLabel("Votre présentation et votre parcours")).toHaveValue("");
  });

  test("Given des textes modifiés, When Océane enregistre, Then ils sont en base, sur l'accueil, et le site est republié (EF-19)", async ({ page }) => {
    await ouvrirTextes(page);
    await page.getByLabel("Votre présentation et votre parcours").fill("Je suis Océane.\n\n\nJ’accompagne les sportifs.");
    await page.getByLabel("Ce que l’on travaille ensemble").fill("- Le sommeil\n\n- La récupération");
    await page.getByLabel("Outil de visio").fill("Google Meet");
    await page.getByLabel("Durée du bilan").fill("1 h 30.");
    await page.getByLabel("Votre formation").fill("");
    await page.getByRole("button", { name: "Enregistrer les textes" }).click();

    await expect(page).toHaveURL(/\/admin\/textes\?enregistre=1&site=demandee$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Les textes sont enregistrés.");
    expect(valeurEnBase("approche")).toBe("Je suis Océane.\n\nJ’accompagne les sportifs.");
    expect(valeurEnBase("themes")).toBe("Le sommeil\nLa récupération");
    expect(valeurEnBase("formation")).toBe("");
    expect(enBase()).toHaveLength(6);
    expect(await appelsPublication()).toHaveLength(1);

    await page.goto("/");
    await expect(page.locator("#approche .col-corps p")).toHaveText(["Je suis Océane.", "J’accompagne les sportifs."]);
    await expect(page.locator("#approche")).not.toContainText("Formée");
    await expect(page.locator(".sport-themes li")).toHaveText(["Le sommeil", "La récupération"]);
    await expect(page.locator("#seances")).toContainText("Je vous réponds par mail avec un lien de visio Google Meet.");
    await expect(page.locator("#seances")).toContainText("Durée 1 h 30. On fait le point");
  });

  test("champ vidé → la phrase ou la liste disparaît de l'accueil", async ({ page }) => {
    await ouvrirTextes(page);
    await page.getByLabel("Votre texte sur l’accompagnement des sportifs").fill("");
    await page.getByLabel("Ce que l’on travaille ensemble").fill("");
    await page.getByRole("button", { name: "Enregistrer les textes" }).click();
    await expect(page).toHaveURL(/enregistre=1/);

    await page.goto("/");
    await expect(page.locator(".sport-titre p")).toHaveCount(0);
    await expect(page.locator(".sport-themes")).toHaveCount(0);
    await expect(page.locator("#sport").getByRole("link", { name: "Demander une séance" })).toBeVisible();
  });

  test("trop long ou plus de 6 thèmes → champ signalé, saisie gardée, rien d'écrit", async ({ page }) => {
    await ouvrirTextes(page);
    await page.getByLabel("Outil de visio").fill("x".repeat(45));
    await page.getByLabel("Ce que l’on travaille ensemble").fill("1\n2\n3\n4\n5\n6\n7");
    await page.getByLabel("Votre présentation et votre parcours").fill("Ne doit pas passer.");
    await expect(page.getByText("45 / 40 caractères")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer les textes" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Certains textes sont à raccourcir : rien n’a été enregistré.");
    await expect(page.getByText("Le texte dépasse 40 caractères (5 en trop).")).toBeVisible();
    await expect(page.getByText("6 lignes au plus (vous en avez 7).")).toBeVisible();
    await expect(page.getByLabel("Outil de visio")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Votre présentation et votre parcours")).toHaveValue("Ne doit pas passer.");
    expect(enBase()).toEqual([]);
    expect(await appelsPublication()).toHaveLength(0);
  });

  test("un texte est affiché tel quel, jamais interprété comme du HTML", async ({ page }) => {
    await ouvrirTextes(page);
    await page.getByLabel("Votre présentation et votre parcours").fill("<b>gras</b> <script>alert(1)</script>");
    await page.getByRole("button", { name: "Enregistrer les textes" }).click();
    await expect(page).toHaveURL(/enregistre=1/);

    await page.goto("/");
    await expect(page.locator("#approche .col-corps p").first()).toHaveText("<b>gras</b> <script>alert(1)</script>");
    await expect(page.locator("#approche b, #approche script")).toHaveCount(0);
  });
});
