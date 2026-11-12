import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";
import { appelsPublication, reinitialiserGithub } from "./outils/github";

// T17 · « Mon accueil » : l'accueil réel avec des crayons (specs/SPEC-edition-visuelle.md, EF-20).

test.describe.configure({ mode: "serial" });

const esp = "[\\u00a0\\u202f ]";
const valeurEnBase = (cle: string) =>
  lignesLocales<{ cle: string; valeur: string }>("SELECT cle, valeur FROM texte").find((l) => l.cle === cle)?.valeur;

async function ouvrirMonAccueil(page: Page) {
  await seConnecter(page);
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Mon accueil" }).click();
  await expect(page).toHaveURL(/\/admin\/accueil$/);
}

test.describe("Mon accueil", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(async () => {
    sqlLocal(`
      DELETE FROM texte; DELETE FROM tarif;
      INSERT INTO tarif (id, libelle, duree_minutes, prix_centimes, ordre) VALUES ('t-bilan', 'Bilan', 90, 7500, 0);
    `);
    await reinitialiserGithub();
  });
  test.afterAll(async () => {
    viderComptes();
    sqlLocal("DELETE FROM texte; DELETE FROM tarif;");
    await reinitialiserGithub();
  });

  test("l'accueil réel s'affiche avec un crayon par zone modifiable", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await expect(page.getByText("Vous modifiez votre accueil.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("La naturopathie, en visio, depuis chez vous.");
    for (const zone of ["Ma spécialité : les sportifs", "Ma spécialité : la gestion du stress", "Mon approche", "Une séance, étape par étape", "Les tarifs"]) {
      await expect(page.getByRole("button", { name: `Modifier « ${zone} »` })).toBeVisible();
    }
  });

  test("Given un crayon, When Océane change le texte et enregistre, Then la zone est à jour, la base aussi, et le site est republié (EF-20)", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Modifier « Mon approche »" }).click();
    const panneau = page.getByRole("dialog", { name: "Mon approche" });
    await expect(panneau).toBeVisible();
    await expect(panneau.getByLabel("Votre formation")).toHaveValue("Formée à la naturopathie de 2020 à 2023.");
    await panneau.getByLabel("Votre présentation et votre parcours").fill("Je m’appelle Océane.");
    await panneau.getByRole("button", { name: "Enregistrer" }).click();

    await expect(panneau).toBeHidden();
    await expect(page.getByRole("status").first()).toContainText("« Mon approche » est enregistré.");
    await expect(page.locator("#approche")).toContainText("Je m’appelle Océane.");
    await expect(page.getByRole("button", { name: "Modifier « Mon approche »" })).toBeFocused();
    expect(valeurEnBase("approche")).toBe("Je m’appelle Océane.");
    expect(valeurEnBase("specialite")).toMatch(/^Que vous prépariez/); // les autres textes ne bougent pas
    expect(await appelsPublication()).toHaveLength(1);

    await page.goto("/");
    await expect(page.locator("#approche")).toContainText("Je m’appelle Océane.");
  });

  test("trop long → champ signalé dans le panneau, rien d'écrit", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Modifier « Une séance, étape par étape »" }).click();
    const panneau = page.getByRole("dialog", { name: "Une séance, étape par étape" });
    await panneau.getByLabel("Outil de visio").fill("x".repeat(45));
    await panneau.getByRole("button", { name: "Enregistrer" }).click();
    await expect(panneau.getByText("Le texte dépasse 40 caractères (5 en trop).")).toBeVisible();
    await expect(panneau).toBeVisible();
    expect(valeurEnBase("outil_visio")).toBeUndefined();
    expect(await appelsPublication()).toHaveLength(0);
  });

  test("Annuler sans rien changer ferme le panneau ; après une saisie, Échap demande confirmation", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Modifier « Ma spécialité : les sportifs »" }).click();
    const panneau = page.getByRole("dialog", { name: "Ma spécialité : les sportifs" });
    await panneau.getByRole("button", { name: "Annuler" }).click();
    await expect(panneau).toBeHidden();

    await page.getByRole("button", { name: "Modifier « Ma spécialité : les sportifs »" }).click();
    await panneau.getByLabel("Votre texte sur l’accompagnement des sportifs").fill("Brouillon à jeter");
    let question = "";
    page.once("dialog", async (d) => { question = d.message(); await d.dismiss(); }); // « non » : on reste
    await page.keyboard.press("Escape");
    expect(question).toBe("Abandonner vos modifications ?");
    await expect(panneau).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");
    await expect(panneau).toBeHidden();
    expect(valeurEnBase("specialite")).toBeUndefined();
  });

  test("le crayon des tarifs ouvre la liste des tarifs ; enregistrer met l'étiquette à jour", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Modifier « Les tarifs »" }).click();
    const panneau = page.getByRole("dialog", { name: "Les tarifs" });
    await panneau.getByLabel("Prix (€)").fill("80");
    await panneau.getByRole("button", { name: "Enregistrer les tarifs" }).click();
    await expect(panneau).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/accueil$/);
    await expect(page.locator(".tarif-prix")).toHaveText([new RegExp(`^80${esp}€$`)]);
    expect(await appelsPublication()).toHaveLength(1);
  });

  test("dans l'aperçu, les liens du site ne mènent nulle part et le formulaire de contact est inactif", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.locator(".apercu-site header").getByRole("link", { name: "Conseils" }).click();
    await page.locator("#sport").getByRole("link", { name: "Demander une séance" }).click();
    await expect(page).toHaveURL(/\/admin\/accueil$/);
    await expect(page.locator("#formulaire-contact")).toBeVisible();
    await expect(page.locator("#formulaire-contact")).toHaveAttribute("inert", "");
  });

  test("sur téléphone, le panneau prend toute la largeur", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Modifier « Mon approche »" }).click();
    const boite = await page.getByRole("dialog", { name: "Mon approche" }).boundingBox();
    expect(Math.round(boite!.width)).toBe(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test("sans session, « Mon accueil » renvoie vers la connexion", async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();
    await page.goto("/admin/accueil");
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await contexte.close();
  });
});
