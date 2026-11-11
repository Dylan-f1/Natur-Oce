import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";
import { appelsPublication, reglerGithub, reinitialiserGithub } from "./outils/github";

// P3 · Déclenchement de la publication depuis l'administration (specs/SPEC-publication.md, D-21).
// Le Worker de test parle au faux GitHub (outils/faux-github.mjs), jamais au vrai.

test.describe.configure({ mode: "serial" });

const doc = (texte: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }] }).replace(/'/g, "''");

function semer() {
  sqlLocal(`
    DELETE FROM article; DELETE FROM categorie;
    INSERT INTO categorie (id, nom, slug, cree_le) VALUES ('c-sport', 'Sport', 'sport', 0);
    INSERT INTO article (id, slug, titre, resume, categorie_id, contenu_json, contenu_html, statut, publie_le, cree_le, modifie_le) VALUES
      ('a-publie', 'deja-publie', 'Déjà publié', 'Un résumé.', 'c-sport', '${doc("Texte.")}', '<p>Texte.</p>', 'publie', 1762000000000, 0, 0),
      ('a-brouillon', 'un-brouillon', 'Un brouillon', '', NULL, '${doc("Idée.")}', '<p>Idée.</p>', 'brouillon', NULL, 0, 0);
  `);
}

const messageSite = (page: Page) => page.getByTestId("message-site");

async function ouvrir(page: Page, titre: string) {
  await page.getByRole("link", { name: titre }).click();
  await expect(page.locator(".editeur-zone")).toBeVisible();
}

test.describe("Publication du site public", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(async () => {
    semer();
    await reinitialiserGithub();
  });
  test.afterAll(async () => {
    viderComptes();
    sqlLocal("DELETE FROM article; DELETE FROM categorie;");
    await reinitialiserGithub();
  });

  test("Given un nouvel article, When Océane publie, Then une publication est demandée à GitHub sur main, avec le jeton", async ({ page }) => {
    await seConnecter(page);
    await page.getByRole("link", { name: "Nouvel article" }).click();
    await expect(page.locator(".editeur-zone")).toBeVisible();
    await page.getByLabel("Titre").fill("Nouveau conseil");
    await page.getByLabel("Catégorie").selectOption({ label: "Sport" });
    await page.getByLabel("Résumé").fill("Un résumé.");
    await page.locator(".editeur-zone").click();
    await page.keyboard.type("Du texte.");
    await page.getByRole("button", { name: "Publier", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\?publie=nouveau-conseil&site=demandee$/);
    await expect(messageSite(page)).toHaveText("Le site public sera à jour d’ici 3 minutes environ.");
    const appels = await appelsPublication();
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatchObject({ depot: "Dylan-f1/Natur-Oce", corps: { ref: "main" }, autorisation: "Bearer jeton-de-test" });
    expect(appels[0].agent).toBeTruthy();
  });

  test("un brouillon jamais publié ne déclenche rien, ni à l'enregistrement ni à la suppression", async ({ page }) => {
    await seConnecter(page);
    await ouvrir(page, "Un brouillon");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\?enregistre=un-brouillon$/);
    await expect(messageSite(page)).toHaveCount(0);

    await ouvrir(page, "Un brouillon");
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/admin\?supprime=1$/);
    expect(await appelsPublication()).toHaveLength(0);
  });

  test("modifier, dépublier et supprimer un article publié demandent chacun une publication", async ({ page }) => {
    await seConnecter(page);
    await ouvrir(page, "Déjà publié");
    await page.getByLabel("Résumé").fill("Un résumé corrigé.");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
    await expect(page).toHaveURL(/\/admin\?modifie=deja-publie&site=demandee$/);

    await ouvrir(page, "Déjà publié");
    await page.getByRole("button", { name: "Dépublier" }).click();
    await expect(page).toHaveURL(/\/admin\?depublie=deja-publie&site=demandee$/);
    expect(await appelsPublication()).toHaveLength(2);

    sqlLocal("UPDATE article SET statut = 'publie' WHERE id = 'a-publie';");
    await page.reload();
    await ouvrir(page, "Déjà publié");
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/admin\?supprime=1&site=demandee$/);
    expect(await appelsPublication()).toHaveLength(3);
  });

  test("Given GitHub en erreur, When Océane publie, Then l'article est enregistré, l'échec est signalé, et « Mettre à jour le site » relance", async ({ page }) => {
    await reglerGithub({ lancement: 500 });
    await seConnecter(page);
    await ouvrir(page, "Un brouillon");
    await page.getByLabel("Catégorie").selectOption({ label: "Sport" });
    await page.getByLabel("Résumé").fill("Un résumé.");
    await page.getByRole("button", { name: "Publier", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\?publie=un-brouillon&site=echec$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("n’a pas pu être lancée");
    expect(lignesLocales<{ statut: string }>("SELECT statut FROM article WHERE id = 'a-brouillon'")[0].statut).toBe("publie");

    await reglerGithub({ lancement: 204 });
    await page.getByRole("button", { name: "Mettre à jour le site" }).click();
    await expect(page).toHaveURL(/\/admin\?site=demandee$/);
    await expect(messageSite(page)).toHaveText("Le site public sera à jour d’ici 3 minutes environ.");
    expect(await appelsPublication()).toHaveLength(2); // l'essai en échec, puis la relance
  });

  test("/admin affiche l'état de la dernière publication", async ({ page }) => {
    await seConnecter(page);
    const etat = page.getByTestId("etat-site");
    await expect(etat).toHaveText("Site public à jour depuis le 11 novembre 2026 à 10:42.");

    await reglerGithub({ derniere: { status: "in_progress", conclusion: null, updated_at: "2026-11-11T09:50:00Z" } });
    await page.reload();
    await expect(etat).toHaveText("Mise à jour du site public en cours…");

    await reglerGithub({ derniere: { status: "completed", conclusion: "failure", updated_at: "2026-11-11T09:55:00Z" } });
    await page.reload();
    await expect(etat).toContainText("a échoué (11 novembre 2026 à 10:55) : il garde la version précédente.");

    await reglerGithub({ derniere: null });
    await page.reload();
    await expect(etat).toHaveText("Aucune mise à jour du site public pour l’instant.");
  });
});
