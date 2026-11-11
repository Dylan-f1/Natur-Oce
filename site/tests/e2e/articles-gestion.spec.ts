import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";

// T9 · Modifier, dépublier, supprimer, filtrer (specs/SPEC-articles.md, EF-08, EF-10).
// P1 : filtre dans le chemin, `/conseils/categorie/<slug>` (specs/SPEC-publication.md).

test.describe.configure({ mode: "serial" });

const ms = (iso: string) => Date.parse(`${iso}T09:00:00Z`);
const doc = (texte: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }] }).replace(/'/g, "''");

function semer() {
  sqlLocal(`
    DELETE FROM article; DELETE FROM categorie;
    INSERT INTO categorie (id, nom, slug, cree_le) VALUES ('c-sommeil', 'Sommeil', 'sommeil', 0), ('c-sport', 'Sport', 'sport', 0), ('c-vide', 'Plantes', 'plantes', 0);
    INSERT INTO article (id, slug, titre, resume, categorie_id, contenu_json, contenu_html, statut, publie_le, cree_le, modifie_le) VALUES
      ('a-dormir', 'bien-dormir', 'Bien dormir après l’effort', 'Trois habitudes pour récupérer la nuit.', 'c-sommeil', '${doc("Version un.")}', '<p>Version un.</p>', 'publie', ${ms("2026-11-01")}, 0, 0),
      ('a-course', 'manger-avant-course', 'Manger avant une course', 'Quoi manger la veille et le matin.', 'c-sport', '${doc("Corps sport.")}', '<p>Corps sport.</p>', 'publie', ${ms("2026-11-05")}, 0, 0),
      ('a-idee', 'idee-etirements', 'Idée : étirements', '', 'c-sport', '${doc("Notes.")}', '<p>Notes.</p>', 'brouillon', NULL, 0, 0);
  `);
}

type Ligne = { slug: string; statut: string; titre: string; contenu_html: string; publie_le: number | null };
const ligne = (id: string) => lignesLocales<Ligne>(`SELECT slug, statut, titre, contenu_html, publie_le FROM article WHERE id = '${id}'`)[0];

async function ouvrir(page: Page, titre: string) {
  await page.getByRole("link", { name: titre }).click();
  await expect(page.locator(".editeur-zone")).toBeVisible(); // éditeur chargé côté client
}

test.describe("Conseils : filtre par catégorie (EF-08)", () => {
  test.beforeAll(semer);

  test("Given 2 catégories publiées, When le visiteur choisit « Sport », Then seuls ses articles s'affichent", async ({ page }) => {
    await page.goto("/conseils");
    const filtres = page.getByRole("navigation", { name: "Catégories" });
    await expect(filtres.getByRole("link")).toHaveText(["Tous", "Sommeil", "Sport"]); // « Plantes » n'a rien de publié
    await expect(filtres.getByRole("link", { name: "Tous" })).toHaveAttribute("aria-current", "page");

    await filtres.getByRole("link", { name: "Sport" }).click();
    await expect(page).toHaveURL(/\/conseils\/categorie\/sport$/);
    await expect(page.locator(".planche h3")).toHaveText(["Manger avant une course"]); // ni Sommeil ni le brouillon
    await expect(filtres.getByRole("link", { name: "Sport" })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle("Conseils : Sport · Natur’Océ");
    const canonique = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonique).toMatch(/\/conseils\/categorie\/sport$/);
  });

  test("la catégorie d'un article mène à son filtre", async ({ page }) => {
    await page.goto("/conseils/bien-dormir");
    await page.locator(".lecture-etiquette").getByRole("link", { name: "Sommeil" }).click();
    await expect(page).toHaveURL(/\/conseils\/categorie\/sommeil$/);
    await expect(page.locator(".planche h3")).toHaveText(["Bien dormir après l’effort"]);
  });

  test("une catégorie inconnue ou mal formée répond 404 ; une catégorie sans article publié l'annonce", async ({ page, request }) => {
    for (const adresse of ["/conseils/categorie/inconnue", "/conseils/categorie/A%27B"]) {
      expect((await request.get(adresse)).status(), adresse).toBe(404);
    }
    await page.goto("/conseils/categorie/plantes");
    await expect(page.getByText("Aucun conseil publié dans cette catégorie pour l’instant.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir tous les conseils" })).toBeVisible();
  });
});

test.describe("Articles : modifier, dépublier, supprimer", () => {
  test.beforeAll(() => {
    viderComptes();
    semer();
  });
  test.afterAll(() => {
    viderComptes();
    sqlLocal("DELETE FROM article; DELETE FROM categorie;");
  });

  test("Given un article publié, When Océane change titre et texte puis enregistre, Then la nouvelle version est en ligne à la même adresse (EF-10)", async ({ page }) => {
    await seConnecter(page);
    await ouvrir(page, "Bien dormir après l’effort");
    await expect(page).toHaveURL(/\/admin\/articles\/a-dormir$/);
    await expect(page.getByLabel("Titre")).toHaveValue("Bien dormir après l’effort");
    await expect(page.getByLabel("Catégorie")).toHaveValue("c-sommeil");
    await expect(page.locator(".editeur-zone")).toHaveText("Version un.");
    await expect(page.getByRole("button", { name: "Publier", exact: true })).toHaveCount(0); // déjà publié

    await page.getByLabel("Titre").fill("Mieux dormir après l’effort");
    await page.locator(".editeur-zone").click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Version deux.");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

    await expect(page).toHaveURL(/\/admin\?modifie=bien-dormir&site=demandee$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Les modifications sont enregistrées.");
    expect(ligne("a-dormir")).toMatchObject({ slug: "bien-dormir", statut: "publie", publie_le: ms("2026-11-01") });

    await page.goto("/conseils/bien-dormir");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mieux dormir après l’effort");
    await expect(page.locator(".corps-article")).toHaveText("Version deux.");
  });

  test("« Dépublier » → 404 en public sans rien perdre ; republier → même adresse", async ({ page, request }) => {
    await seConnecter(page);
    await ouvrir(page, "Mieux dormir après l’effort");
    await page.getByRole("button", { name: "Dépublier" }).click();

    await expect(page).toHaveURL(/\/admin\?depublie=bien-dormir&site=demandee$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("L’article est dépublié : il reste dans vos brouillons.");
    expect((await request.get("/conseils/bien-dormir")).status()).toBe(404);
    expect(ligne("a-dormir")).toMatchObject({ statut: "brouillon", titre: "Mieux dormir après l’effort", contenu_html: "<p>Version deux.</p>" });

    // Le titre a changé, mais l'adresse a été figée à la 1re publication (EF-07).
    await ouvrir(page, "Mieux dormir après l’effort");
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?publie=bien-dormir&site=demandee$/);
    expect((await request.get("/conseils/bien-dormir")).status()).toBe(200);
  });

  test("« Supprimer » demande confirmation ; « Annuler » ne supprime rien ; confirmer supprime définitivement", async ({ page }) => {
    await seConnecter(page);
    await ouvrir(page, "Idée : étirements");

    await page.getByRole("button", { name: "Supprimer" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Supprimer cet article ?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Idée : étirements");
    await confirmation.getByRole("button", { name: "Annuler" }).click();
    await expect(confirmation).toBeHidden();
    expect(ligne("a-idee")).toBeDefined();

    await page.getByRole("button", { name: "Supprimer" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page).toHaveURL(/\/admin\?supprime=1$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("L’article est supprimé.");
    expect(ligne("a-idee")).toBeUndefined();
    await expect(page.locator(".liste-articles")).not.toContainText("Idée : étirements");
  });

  test("un article inconnu répond 404 dans l'administration", async ({ page }) => {
    await seConnecter(page);
    const reponse = await page.goto("/admin/articles/inconnu");
    expect(reponse?.status()).toBe(404);
  });
});
