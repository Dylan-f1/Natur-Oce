import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";

// T7 · Créer et publier un article (specs/SPEC-articles.md, EF-09, D-20).

test.describe.configure({ mode: "serial" });

function viderArticles() {
  sqlLocal("DELETE FROM article; DELETE FROM categorie;");
}

async function ouvrirNouvelArticle(page: Page) {
  await seConnecter(page);
  await page.getByRole("link", { name: "Nouvel article" }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/nouveau$/);
  await expect(page.locator(".editeur-zone")).toBeVisible(); // éditeur chargé côté client
}

type LigneArticle = { slug: string; statut: string; contenu_html: string; resume: string; categorie: string | null };

test.describe("Articles : créer et publier", () => {
  test.beforeAll(() => {
    viderComptes();
    viderArticles();
  });
  test.afterAll(() => {
    viderComptes();
    viderArticles();
  });

  test("Given un titre et un texte, When Océane enregistre le brouillon, Then il apparaît dans la liste", async ({ page }) => {
    await ouvrirNouvelArticle(page);
    await page.getByLabel("Titre").fill("Brouillon sur la récupération");
    await page.locator(".editeur-zone").click();
    await page.keyboard.type("Premières idées.");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();

    await expect(page).toHaveURL(/\/admin\?enregistre=brouillon-sur-la-recuperation$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Le brouillon est enregistré.");
    const premier = page.locator(".liste-articles li").first();
    await expect(premier).toHaveAttribute("data-statut", "brouillon");
    await expect(premier).toContainText("Brouillon sur la récupération");
  });

  test("Given titre, texte et catégorie, When Océane clique « Publier », Then l'article est publié avec son adresse et son HTML rendu côté serveur (EF-09)", async ({ page }) => {
    await ouvrirNouvelArticle(page);
    await page.getByLabel("Titre").fill("Récupération & sommeil du sportif !");
    await page.getByLabel("Catégorie").selectOption({ label: "+ Nouvelle catégorie…" });
    await page.getByLabel("Nom de la nouvelle catégorie").fill("Sommeil");
    await page.getByLabel("Résumé").fill("Trois habitudes pour mieux récupérer après l’entraînement.");
    await page.locator(".editeur-zone").click();
    await page.keyboard.type("Dormir est la ");
    await page.getByRole("button", { name: "Gras", exact: true }).click();
    await page.keyboard.type("première");
    await page.getByRole("button", { name: "Gras", exact: true }).click();
    await page.keyboard.type(" étape <script>alert(1)</script>");
    await page.getByRole("button", { name: "Publier" }).click();

    await expect(page).toHaveURL(/\/admin\?publie=recuperation-sommeil-du-sportif&site=demandee$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("L’article est publié.");

    const [ligne] = lignesLocales<LigneArticle>(
      "SELECT a.slug, a.statut, a.contenu_html, a.resume, c.nom AS categorie FROM article a LEFT JOIN categorie c ON c.id = a.categorie_id WHERE a.statut = 'publie'",
    );
    expect(ligne.slug).toBe("recuperation-sommeil-du-sportif");
    expect(ligne.categorie).toBe("Sommeil");
    expect(ligne.contenu_html).toBe(
      "<p>Dormir est la <strong>première</strong> étape &lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  test("les brouillons sont listés avant les articles publiés", async ({ page }) => {
    await seConnecter(page);
    const statuts = await page.locator(".liste-articles li").evaluateAll((li) => li.map((e) => e.getAttribute("data-statut")));
    expect(statuts).toEqual(["brouillon", "publie"]);
  });

  test("Given un titre trop long, When Océane publie, Then le message dit de combien il dépasse et la saisie est conservée", async ({ page }) => {
    await ouvrirNouvelArticle(page);
    const titre = "Un titre beaucoup trop long pour tenir dans la limite de quatre-vingt-dix caractères du site !!";
    await page.getByLabel("Titre").fill(titre);
    await page.getByLabel("Résumé").fill("Résumé conservé");
    await page.locator(".editeur-zone").click();
    await page.keyboard.type("Texte conservé.");
    await page.getByRole("button", { name: "Publier" }).click();

    const depassement = [...titre].length - 90;
    await expect(page.getByText(`Le titre dépasse de ${depassement} caractère`)).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveValue(titre);
    await expect(page.getByLabel("Résumé")).toHaveValue("Résumé conservé");
    await expect(page.locator(".editeur-zone")).toContainText("Texte conservé.");
    expect(lignesLocales("SELECT id FROM article")).toHaveLength(2); // rien d'enregistré en plus
  });

  test("l'éditeur n'est jamais envoyé aux visiteurs : aucun script de l'accueil ne contient ProseMirror (RSE-01)", async ({ page, request }) => {
    await page.goto("/");
    const scripts = await page.locator("script[src]").evaluateAll((s) => s.map((e) => (e as HTMLScriptElement).src));
    expect(scripts.length).toBeGreaterThan(0);
    for (const src of scripts) {
      const code = await (await request.get(src)).text();
      expect(code.includes("ProseMirror"), src).toBe(false);
    }
  });
});
