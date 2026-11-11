import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";

// T10 · Images des articles (specs/SPEC-images.md, EF-11, D-22).

test.describe.configure({ mode: "serial" });

const racine = join(__dirname, "..", "..");

function instantane(...args: string[]): string {
  return execFileSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(racine, "scripts", "instantane.ts"), ...args],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
}

/** Photo d'exemple fabriquée par le navigateur : PNG de 2000 × 1200 px (plus large que 1600). */
async function photoExemple(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const toile = document.createElement("canvas");
    toile.width = 2000;
    toile.height = 1200;
    const c = toile.getContext("2d")!;
    const degrade = c.createLinearGradient(0, 0, 2000, 1200);
    degrade.addColorStop(0, "#3D491B");
    degrade.addColorStop(1, "#C9882E");
    c.fillStyle = degrade;
    c.fillRect(0, 0, 2000, 1200);
    const blob = await new Promise<Blob>((r) => toile.toBlob((b) => r(b!), "image/png"));
    const octets = new Uint8Array(await blob.arrayBuffer());
    let binaire = "";
    for (const o of octets) binaire += String.fromCharCode(o);
    return btoa(binaire);
  });
  return Buffer.from(base64, "base64");
}

async function ouvrirNouvelArticle(page: Page) {
  await seConnecter(page);
  await page.getByRole("link", { name: "Nouvel article" }).click();
  await expect(page.locator(".editeur-zone")).toBeVisible();
}

test.describe("Images des articles", () => {
  test.beforeAll(() => {
    viderComptes();
    sqlLocal("DELETE FROM article; DELETE FROM categorie; DELETE FROM image;");
  });
  test.afterAll(() => {
    instantane("--nettoyer");
    viderComptes();
    sqlLocal("DELETE FROM article; DELETE FROM categorie; DELETE FROM image;");
  });

  test("sans session, l'envoi est refusé et rien n'est enregistré", async ({ request }) => {
    const sansCookie = await request.post("/admin/api/images", { data: Buffer.from("x"), maxRedirects: 0 });
    expect(sansCookie.status()).toBe(307); // le proxy renvoie vers la connexion
    const fauxCookie = await request.post("/admin/api/images", {
      data: Buffer.from("x"),
      headers: { cookie: "natur-oce.session_token=faux.jeton", origin: "http://127.0.0.1:8791" },
      maxRedirects: 0,
    });
    expect(fauxCookie.status()).toBe(401); // la session est vérifiée en base (ENF-03)
    expect(lignesLocales("SELECT cle FROM image")).toHaveLength(0);
  });

  test("connectée, un envoi depuis une autre origine ou qui n'est pas une image est refusé", async ({ page }) => {
    await seConnecter(page);
    const autreOrigine = await page.request.post("/admin/api/images", {
      data: Buffer.from([0xff, 0xd8, 0xff]),
      headers: { origin: "https://exemple.test", "content-type": "image/jpeg" },
    });
    expect(autreOrigine.status()).toBe(403);
    const deguise = await page.request.post("/admin/api/images", {
      data: Buffer.from("<!DOCTYPE html><script>alert(1)</script>"),
      headers: { origin: "http://127.0.0.1:8791", "content-type": "image/webp" },
    });
    expect(deguise.status()).toBe(415);
    expect(lignesLocales("SELECT cle FROM image")).toHaveLength(0);
  });

  test("fichier d'un autre type ou de plus de 10 Mo : rien n'est envoyé, le message dit la limite et les formats", async ({ page }) => {
    await ouvrirNouvelArticle(page);
    await page.getByRole("button", { name: "Image", exact: true }).click();
    await page.getByLabel("Texte de description de l’image").fill("Un document");

    await page.getByLabel("Photo").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7") });
    await page.getByRole("button", { name: "Insérer l’image" }).click();
    await expect(page.getByText("Ce fichier n’est pas une image acceptée. Formats possibles : JPEG, PNG, WebP ou HEIC, 10 Mo au plus.")).toBeVisible();

    await page.getByLabel("Photo").setInputFiles({ name: "enorme.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await page.getByRole("button", { name: "Insérer l’image" }).click();
    await expect(page.getByText("Cette image pèse plus de 10 Mo.")).toBeVisible();
    await expect(page.locator(".editeur-zone img")).toHaveCount(0);
    expect(lignesLocales("SELECT cle FROM image")).toHaveLength(0);
  });

  test("Given une photo, When Océane l'insère sans description, Then elle n'est pas insérée ; avec description, Then elle s'affiche dans l'article publié (EF-11)", async ({ page, request }) => {
    await ouvrirNouvelArticle(page);
    const photo = await photoExemple(page);
    await page.getByLabel("Titre").fill("Article illustré");
    await page.getByLabel("Catégorie").selectOption({ label: "+ Nouvelle catégorie…" });
    await page.getByLabel("Nom de la nouvelle catégorie").fill("Alimentation");
    await page.getByLabel("Résumé").fill("Un article avec une photo.");
    await page.locator(".editeur-zone").click();
    await page.keyboard.type("Avant la photo.");

    await page.getByRole("button", { name: "Image", exact: true }).click();
    await page.getByLabel("Photo").setInputFiles({ name: "legumes.png", mimeType: "image/png", buffer: photo });
    await page.getByRole("button", { name: "Insérer l’image" }).click();
    await expect(page.getByText("Décrivez l’image : sans description, elle n’est pas insérée.")).toBeVisible();
    await expect(page.locator(".editeur-zone img")).toHaveCount(0);

    await page.getByLabel("Texte de description de l’image").fill("Un dégradé vert et or");
    await page.getByRole("button", { name: "Insérer l’image" }).click();
    const dansEditeur = page.locator(".editeur-zone img");
    await expect(dansEditeur).toHaveAttribute("alt", "Un dégradé vert et or");
    await expect(page.getByRole("button", { name: "Insérer l’image" })).toBeHidden(); // panneau refermé

    // Réduite dans le navigateur : 1600 px de large, en WebP sous Chrome ; dimensions lues par le serveur.
    const [enBase] = lignesLocales<{ cle: string; type: string; largeur: number; hauteur: number; taille: number }>(
      "SELECT cle, type, largeur, hauteur, taille FROM image",
    );
    expect(enBase).toMatchObject({ type: "image/webp", largeur: 1600, hauteur: 960 });
    expect(enBase.cle).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(enBase.taille).toBeLessThanOrEqual(1_500_000);

    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?publie=article-illustre/);

    await page.goto("/conseils/article-illustre");
    const img = page.locator(".corps-article img");
    await expect(img).toHaveAttribute("src", `/images/${enBase.cle}`);
    await expect(img).toHaveAttribute("alt", "Un dégradé vert et or");
    await expect(img).toHaveAttribute("width", "1600");
    await expect(img).toHaveAttribute("height", "960");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect.poll(() => img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBe(1600); // vraiment affichée

    const fichier = await request.get(`/images/${enBase.cle}`);
    expect(fichier.status()).toBe(200);
    expect(fichier.headers()["content-type"]).toBe("image/webp");
    expect(fichier.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect((await request.get("/images/00000000-0000-4000-8000-000000000000.webp")).status()).toBe(404);
  });

  test("l'instantané fige l'image citée par l'article, servie en fichier avec le cache d'un an", async ({ request, baseURL }) => {
    const [{ cle }] = lignesLocales<{ cle: string }>("SELECT cle FROM image");
    // Comme dans la GitHub Action : images prises sur « le site en ligne » (ici le serveur de test).
    const sortie = instantane("--serveur", baseURL!, "--images-depuis", baseURL!);
    expect(sortie).toContain(`/images/${cle} → images/${cle}`);
    expect(sortie).toContain("1 image(s) figée(s)");

    // Retirée de la base, l'image reste servie : c'est bien le fichier figé, pas le Worker.
    sqlLocal(`DELETE FROM image WHERE cle = '${cle}';`);
    await expect.poll(async () => (await request.get(`/images/${cle}`)).status(), { timeout: 30_000 }).toBe(200);
    const fichier = await request.get(`/images/${cle}`);
    expect(fichier.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(fichier.headers()["content-type"]).toBe("image/webp");
  });
});
