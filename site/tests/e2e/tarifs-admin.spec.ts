import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";
import { appelsPublication, reinitialiserGithub } from "./outils/github";

// T11 · Tarifs modifiables (specs/SPEC-tarifs.md, EF-03, EF-12).

test.describe.configure({ mode: "serial" });

// Espace fine insécable entre le montant et « € » (format français d'Intl).
const esp = "[\\u00a0\\u202f ]";

function semer() {
  sqlLocal(`
    DELETE FROM tarif;
    INSERT INTO tarif (id, libelle, duree_minutes, prix_centimes, ordre) VALUES
      ('t-bilan', 'Bilan', 90, 7500, 0),
      ('t-suivi', 'Suivi', 45, 6250, 1);
  `);
}

type Ligne = { libelle: string; duree_minutes: number | null; prix_centimes: number; ordre: number };
const enBase = () => lignesLocales<Ligne>("SELECT libelle, duree_minutes, prix_centimes, ordre FROM tarif ORDER BY ordre");

const ligne = (page: Page, n: number) => page.getByTestId("ligne-tarif").nth(n);

async function ouvrirTarifs(page: Page) {
  await seConnecter(page);
  await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/admin\/tarifs$/);
}

test.describe("Tarifs dans l'administration", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(async () => {
    semer();
    await reinitialiserGithub();
  });
  test.afterAll(async () => {
    viderComptes();
    sqlLocal("DELETE FROM tarif;");
    await reinitialiserGithub();
  });

  test("la page reprend les tarifs dans l'ordre, prix au format de saisie", async ({ page }) => {
    await ouvrirTarifs(page);
    await expect(page.getByTestId("ligne-tarif")).toHaveCount(2);
    await expect(ligne(page, 0).getByLabel("Nom de la séance")).toHaveValue("Bilan");
    await expect(ligne(page, 0).getByLabel("Durée (min)")).toHaveValue("90");
    await expect(ligne(page, 0).getByLabel("Prix (€)")).toHaveValue("75");
    await expect(ligne(page, 1).getByLabel("Prix (€)")).toHaveValue("62,50");
  });

  test("Given un tarif modifié, When Océane enregistre, Then il est en base, l'accueil l'affiche, et le site est republié (EF-12)", async ({ page }) => {
    await ouvrirTarifs(page);
    await ligne(page, 1).getByLabel("Prix (€)").fill("65,00");
    await ligne(page, 1).getByLabel("Durée (min)").fill("");
    await page.getByRole("button", { name: "Enregistrer les tarifs" }).click();

    await expect(page).toHaveURL(/\/admin\/tarifs\?enregistre=1&site=demandee$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Les tarifs sont enregistrés.");
    await expect(page.getByTestId("message-site")).toHaveText("Le site public sera à jour d’ici 3 minutes environ.");
    expect(enBase()).toEqual([
      { libelle: "Bilan", duree_minutes: 90, prix_centimes: 7500, ordre: 0 },
      { libelle: "Suivi", duree_minutes: null, prix_centimes: 6500, ordre: 1 },
    ]);
    expect(await appelsPublication()).toHaveLength(1);

    await page.goto("/");
    const lignes = page.locator(".tarifs > span");
    await expect(lignes.nth(1)).toHaveText(new RegExp(`^Suivi 65${esp}€$`));
  });

  test.describe("prix invalide → ligne signalée, rien d'écrit", () => {
    for (const prix of ["-5", "1000", "douze"]) {
      test(`prix « ${prix} »`, async ({ page }) => {
        await ouvrirTarifs(page);
        await ligne(page, 0).getByLabel("Prix (€)").fill(prix);
        await ligne(page, 1).getByLabel("Nom de la séance").fill("Suivi modifié"); // ne doit pas passer non plus
        await page.getByRole("button", { name: "Enregistrer les tarifs" }).click();

        await expect(page.getByRole("main").getByRole("alert").first()).toHaveText("Certaines lignes sont à corriger : rien n’a été enregistré.");
        await expect(ligne(page, 0).getByLabel("Prix (€)")).toHaveAttribute("aria-invalid", "true");
        await expect(ligne(page, 0).getByText("Prix en euros entre 0 et 999, par exemple 62,50.")).toBeVisible();
        await expect(ligne(page, 0).getByLabel("Prix (€)")).toHaveValue(prix); // saisie conservée
        await expect(ligne(page, 1).getByLabel("Nom de la séance")).toHaveValue("Suivi modifié");
        expect(enBase().map((l) => [l.libelle, l.prix_centimes])).toEqual([["Bilan", 7500], ["Suivi", 6250]]);
        expect(await appelsPublication()).toHaveLength(0);
      });
    }
  });

  test("ajouter, réordonner et supprimer : l'accueil suit le même ordre", async ({ page }) => {
    await ouvrirTarifs(page);
    await page.getByRole("button", { name: "Ajouter un tarif" }).click();
    await expect(ligne(page, 2).getByLabel("Nom de la séance")).toBeFocused(); // prête à écrire
    await page.keyboard.type("Séance sportive");
    await ligne(page, 2).getByLabel("Durée (min)").fill("60");
    await ligne(page, 2).getByLabel("Prix (€)").fill("70");

    await page.getByRole("button", { name: "Monter « Séance sportive »" }).click();
    await expect(page.getByRole("button", { name: "Monter « Séance sportive »" })).toBeFocused(); // le clavier suit la ligne
    await page.getByRole("button", { name: "Monter « Séance sportive »" }).click();
    await page.getByRole("button", { name: "Supprimer « Suivi »" }).click();
    await expect(page.getByTestId("ligne-tarif")).toHaveCount(2);
    await page.getByRole("button", { name: "Enregistrer les tarifs" }).click();
    await expect(page).toHaveURL(/enregistre=1/);

    expect(enBase().map((l) => [l.libelle, l.ordre])).toEqual([["Séance sportive", 0], ["Bilan", 1]]);
    await page.goto("/");
    await expect(page.locator(".tarifs > span")).toHaveText([
      new RegExp(`^Séance sportive \\(1 h\\) 70${esp}€$`),
      new RegExp(`^Bilan \\(1 h 30\\) 75${esp}€$`),
    ]);
  });

  test("tout supprimer → l'accueil affiche « Tarifs sur demande »", async ({ page }) => {
    await ouvrirTarifs(page);
    await page.getByRole("button", { name: "Supprimer « Bilan »" }).click();
    await page.getByRole("button", { name: "Supprimer « Suivi »" }).click();
    await expect(page.getByText("Aucun tarif : l’accueil affiche « Tarifs sur demande ».")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer les tarifs" }).click();
    await expect(page).toHaveURL(/enregistre=1/);
    expect(enBase()).toEqual([]);
    await page.goto("/");
    await expect(page.locator(".tarifs")).toHaveText("Tarifs sur demande");
  });

  test("sans session, la page des tarifs renvoie vers la connexion", async ({ request }) => {
    const reponse = await request.get("/admin/tarifs", { maxRedirects: 0 });
    expect(reponse.status()).toBe(307);
  });
});
