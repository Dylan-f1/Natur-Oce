import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { sqlLocal } from "./outils/d1";

// P2 · Instantané des pages publiques (specs/SPEC-publication.md, D-21) : après le script, les
// pages publiques sont servies par des fichiers, plus par le Worker.

test.describe.configure({ mode: "serial" });

const racine = join(__dirname, "..", "..");
const MARQUE = 'name="instantane"';

function instantane(...args: string[]): string {
  return execFileSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(racine, "scripts", "instantane.ts"), ...args],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
}

async function texte(request: APIRequestContext, adresse: string): Promise<string> {
  return (await request.get(adresse)).text();
}

test.describe("Instantané des pages publiques", () => {
  test.beforeAll(() => {
    sqlLocal(`
      DELETE FROM article; DELETE FROM categorie;
      INSERT INTO categorie (id, nom, slug, cree_le) VALUES ('c-sommeil', 'Sommeil', 'sommeil', 0), ('c-vide', 'Plantes', 'plantes', 0);
      INSERT INTO article (id, slug, titre, resume, categorie_id, contenu_json, contenu_html, statut, publie_le, cree_le, modifie_le) VALUES
        ('a1', 'bien-dormir', 'Bien dormir après l’effort', 'Trois habitudes.', 'c-sommeil', '{}', '<p>Corps un</p>', 'publie', 1762000000000, 0, 0),
        ('a2', 'sans-categorie', 'Un conseil sans catégorie', 'Un résumé.', NULL, '{}', '<p>Corps deux</p>', 'publie', 1761000000000, 0, 0),
        ('a3', 'brouillon-cache', 'Brouillon caché', '', 'c-vide', '{}', '<p>secret</p>', 'brouillon', NULL, 0, 0);
    `);
  });

  test.afterAll(async ({ request }) => {
    instantane("--nettoyer");
    await expect.poll(() => texte(request, "/"), { timeout: 30_000 }).not.toContain(MARQUE); // le Worker reprend la main
    sqlLocal("DELETE FROM article; DELETE FROM categorie;");
  });

  test("Given 2 articles publiés et 1 brouillon, When l'instantané tourne, Then accueil, liste, articles et catégorie sont servis par des fichiers", async ({ baseURL }) => {
    const sortie = instantane("--serveur", baseURL!);
    expect(sortie).toContain("/conseils/bien-dormir → conseils/bien-dormir.html");
    expect(sortie).toContain("/conseils/categorie/sommeil → conseils/categorie/sommeil.html");
    expect(sortie).toContain("7 page(s) écrite(s)"); // /, /conseils, 2 articles, 1 catégorie, 2 retours du formulaire
    expect(sortie).not.toContain("brouillon-cache");
    expect(sortie).not.toContain("plantes");
  });

  test("les pages figées portent la marque de l'instantané", async ({ request }) => {
    for (const adresse of ["/", "/conseils", "/conseils/bien-dormir", "/conseils/sans-categorie", "/conseils/categorie/sommeil"]) {
      await expect.poll(() => texte(request, adresse), { message: adresse, timeout: 30_000 }).toContain(MARQUE);
    }
  });

  test("le brouillon, la catégorie vide et une adresse inconnue restent au Worker (404, sans marque)", async ({ request }) => {
    for (const adresse of ["/conseils/brouillon-cache", "/conseils/categorie/plantes", "/conseils/inconnu"]) {
      const reponse = await request.get(adresse);
      expect(await reponse.text(), adresse).not.toContain(MARQUE);
    }
    expect((await request.get("/conseils/brouillon-cache")).status()).toBe(404);
    expect((await request.get("/conseils/inconnu")).status()).toBe(404);
  });

  test("une page figée ne change plus tant que l'instantané n'est pas refait", async ({ request }) => {
    sqlLocal("UPDATE article SET titre = 'Titre changé après coup' WHERE id = 'a1';");
    const html = await texte(request, "/conseils/bien-dormir");
    expect(html).toContain("Bien dormir après l’effort");
    expect(html).not.toContain("Titre changé après coup");
  });

  test("relancer l'instantané remplace l'ancien sans le recopier", async ({ request, baseURL }) => {
    const sortie = instantane("--serveur", baseURL!);
    expect(sortie).toContain("7 fichier(s) de l'instantané précédent retiré(s)");
    await expect.poll(() => texte(request, "/conseils/bien-dormir"), { timeout: 30_000 }).toContain("Titre changé après coup");
    expect(await texte(request, "/conseils/bien-dormir")).toContain(MARQUE);
  });
});
