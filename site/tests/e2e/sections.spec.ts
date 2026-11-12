import { expect, test, type Page } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes } from "./outils/connexion";
import { appelsPublication, reinitialiserGithub } from "./outils/github";

// T18 · Sections ajoutées par Océane depuis « Mon accueil » (specs/SPEC-edition-visuelle.md, EF-21).

test.describe.configure({ mode: "serial" });

type Ligne = { titre: string; modele: string; apres: string; ordre: number; bouton: number; image_cle: string | null; image_alt: string | null };
const enBase = () => lignesLocales<Ligne>("SELECT titre, modele, apres, ordre, bouton, image_cle, image_alt FROM section ORDER BY apres, ordre");

async function ouvrirMonAccueil(page: Page) {
  await seConnecter(page);
  await page.goto("/admin/accueil");
  await expect(page.getByText("Vous modifiez votre accueil.")).toBeVisible();
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

/** Sections de l'accueil public, dans l'ordre de la page (titres h2). */
async function titresPublics(page: Page) {
  await page.goto("/");
  return page.locator("main section h2").allTextContents();
}

test.describe("Sections ajoutées", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(async () => {
    sqlLocal("DELETE FROM section;");
    await reinitialiserGithub();
  });
  test.afterAll(async () => {
    viderComptes();
    sqlLocal("DELETE FROM section;");
    await reinitialiserGithub();
  });

  test("ajouter une section « Texte simple » après « Mon approche » : elle apparaît à cet endroit, ici et en public (EF-21)", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Ajouter une section après « Mon approche »" }).click();
    const panneau = page.getByRole("dialog", { name: "Nouvelle section" });
    await panneau.getByRole("button", { name: /Texte simple/ }).click();
    await panneau.getByLabel("Titre de la section").fill("Mes ateliers d’été");
    await panneau.getByLabel(/^Texte/).fill("Premier paragraphe.\n\nDeuxième paragraphe.");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();

    await expect(panneau).toBeHidden();
    await expect(page.getByRole("status").first()).toContainText("La section est ajoutée.");
    const section = page.locator("#mes-ateliers-d-ete");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Mes ateliers d’été");
    await expect(section.locator(".col-corps p")).toHaveText(["Premier paragraphe.", "Deuxième paragraphe."]);
    expect(enBase()).toEqual([{ titre: "Mes ateliers d’été", modele: "texte", apres: "approche", ordre: 0, bouton: 0, image_cle: null, image_alt: null }]);
    expect(await appelsPublication()).toHaveLength(1);

    const titres = await titresPublics(page);
    expect(titres.indexOf("Mes ateliers d’été")).toBe(titres.indexOf("Mon approche") + 1);
    await expect(page.locator(".crayon, .ajouter-section, .outils-section")).toHaveCount(0); // rien d'édition en public
  });

  test("« Texte + liste » : titre, liste obligatoire, bouton « Demander une séance » ; champ manquant → refusé", async ({ page }) => {
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Ajouter une section après « Ma spécialité : la gestion du stress »" }).click();
    const panneau = page.getByRole("dialog", { name: "Nouvelle section" });
    await panneau.getByRole("button", { name: /Texte \+ liste/ }).click();
    await panneau.getByLabel("Titre de la section").fill("Sommeil");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();
    await expect(panneau.getByText("Ajoutez au moins un thème, un par ligne.")).toBeVisible();
    expect(enBase()).toEqual([]);

    await panneau.getByLabel("Liste des thèmes").fill("Le rythme\nLes écrans le soir");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();
    await expect(panneau).toBeHidden();
    const section = page.locator("#sommeil");
    await expect(section.locator(".liste-ajoutee li")).toHaveText(["Le rythme", "Les écrans le soir"]);
    await expect(section.getByRole("link", { name: "Demander une séance" })).toBeVisible();
    expect(enBase()[0]).toMatchObject({ modele: "texte_liste", apres: "stress", bouton: 1 });
  });

  test("« Texte + photo » : photo et description obligatoires ; la photo est réduite, rangée et affichée (T19)", async ({ page }) => {
    await ouvrirMonAccueil(page);
    const photo = await photoExemple(page);
    await page.getByRole("button", { name: "Ajouter une section après « Une séance, étape par étape »" }).click();
    const panneau = page.getByRole("dialog", { name: "Nouvelle section" });
    await panneau.getByRole("button", { name: /Texte \+ photo/ }).click();
    await panneau.getByLabel("Titre de la section").fill("Mon cabinet en visio");
    await panneau.getByLabel(/^Texte/).fill("Un coin calme, une tisane.");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();
    await expect(panneau.getByText("Choisissez une photo.")).toBeVisible();
    await expect(panneau.getByText("Décrivez la photo : sans description, la section n’est pas enregistrée.")).toBeVisible();
    expect(enBase()).toEqual([]);

    await panneau.getByLabel("Photo", { exact: true }).setInputFiles({ name: "bureau.png", mimeType: "image/png", buffer: photo });
    await panneau.getByLabel("Description de la photo").fill("Un bureau avec un ordinateur et une tasse");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();
    await expect(panneau).toBeHidden();

    const [ligne] = enBase();
    expect(ligne).toMatchObject({ modele: "texte_photo", apres: "seances", image_alt: "Un bureau avec un ordinateur et une tasse" });
    expect(ligne.image_cle).toMatch(/^[0-9a-f-]{36}\.(webp|jpg)$/);
    const image = page.locator("#mon-cabinet-en-visio img");
    await expect(image).toHaveAttribute("src", `/images/${ligne.image_cle}`);
    await expect(image).toHaveAttribute("alt", "Un bureau avec un ordinateur et une tasse");
    expect(await image.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeLessThanOrEqual(1600); // réduite

    await page.goto("/");
    await expect(page.locator("#mon-cabinet-en-visio img")).toHaveAttribute("src", `/images/${ligne.image_cle}`);
  });

  test("modifier, monter, descendre et supprimer une section", async ({ page }) => {
    sqlLocal(`
      INSERT INTO section (id, modele, titre, texte, liste, bouton, apres, ordre, modifie_le) VALUES
        ('s-a', 'texte', 'Alpha', 'A.', '', 0, 'approche', 0, 0),
        ('s-b', 'texte', 'Bêta', 'B.', '', 0, 'approche', 1, 0);
    `);
    await ouvrirMonAccueil(page);

    await page.getByRole("button", { name: "Modifier « Bêta »" }).click();
    const panneau = page.getByRole("dialog", { name: "Bêta" });
    await expect(panneau.getByLabel("Titre de la section")).toHaveValue("Bêta");
    await panneau.getByLabel("Titre de la section").fill("Bêta modifiée");
    await panneau.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#beta-modifiee h2")).toHaveText("Bêta modifiée");

    await page.getByRole("button", { name: "Monter « Bêta modifiée »" }).click();
    await expect(page.getByRole("status").first()).toContainText("La section est déplacée.");
    await expect.poll(() => enBase().map((l) => l.titre)).toEqual(["Bêta modifiée", "Alpha"]);

    await page.getByRole("button", { name: "Descendre « Alpha »" }).click(); // en bout : passe après « Une séance »
    await expect.poll(() => enBase().map((l) => [l.titre, l.apres])).toEqual([["Bêta modifiée", "approche"], ["Alpha", "seances"]]);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Supprimer « Alpha »" }).click();
    await expect(page.locator("#alpha")).toHaveCount(0);
    expect(enBase().map((l) => l.titre)).toEqual(["Bêta modifiée"]);

    const titres = await titresPublics(page);
    expect(titres).toContain("Bêta modifiée");
    expect(titres).not.toContain("Alpha");
  });

  test("tout en haut, « Monter » est grisé ; refuser la suppression ne supprime rien", async ({ page }) => {
    sqlLocal("INSERT INTO section (id, modele, titre, texte, liste, bouton, apres, ordre, modifie_le) VALUES ('s-h', 'texte', 'Haut', 'H.', '', 0, 'stress', 0, 0);");
    await ouvrirMonAccueil(page);
    await expect(page.getByRole("button", { name: "Monter « Haut »" })).toBeDisabled();
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Supprimer « Haut »" }).click();
    await expect(page.locator("#haut")).toHaveCount(1);
    expect(enBase()).toHaveLength(1);
  });

  test("au-delà de 8 sections, l'ajout est refusé avec un message clair", async ({ page }) => {
    const valeurs = Array.from({ length: 8 }, (_, i) => `('s-${i}', 'texte', 'Section ${i}', 'T.', '', 0, 'conseils', ${i}, 0)`).join(", ");
    sqlLocal(`INSERT INTO section (id, modele, titre, texte, liste, bouton, apres, ordre, modifie_le) VALUES ${valeurs};`);
    await ouvrirMonAccueil(page);
    await page.getByRole("button", { name: "Ajouter une section après « Conseils »" }).click();
    const panneau = page.getByRole("dialog", { name: "Nouvelle section" });
    await panneau.getByRole("button", { name: /Texte simple/ }).click();
    await panneau.getByLabel("Titre de la section").fill("Neuvième");
    await panneau.getByLabel(/^Texte/).fill("Non.");
    await panneau.getByRole("button", { name: "Ajouter la section" }).click();
    await expect(panneau.getByRole("alert")).toHaveText("8 sections ajoutées au plus : supprimez-en une d’abord.");
    expect(enBase()).toHaveLength(8);
  });
});
