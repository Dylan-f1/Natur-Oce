import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { compterLignes, lignesLocales, sqlLocal } from "./outils/d1";
import { OCEANE, viderComptes } from "./outils/connexion";

// T13 · Lien de connexion de secours (specs/SPEC-connexion.md, R-15).

test.describe.configure({ mode: "serial" });

const racine = join(__dirname, "..", "..");
const EXPIRE = "Ce lien a expiré. Demandez-en un nouveau.";

/** Lance le script comme Dylan le ferait, et renvoie le lien qu'il affiche. */
function lienDeSecours(...args: string[]): { lien: string; sortie: string } {
  const sortie = execFileSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(racine, "scripts", "lien-secours.ts"), ...args],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
  const lien = sortie.match(/http:\/\/127\.0\.0\.1:\d+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
  if (!lien) throw new Error(`Pas de lien dans la sortie :\n${sortie}`);
  return { lien, sortie };
}

test.describe("Lien de connexion de secours", () => {
  test.beforeEach(() => viderComptes());
  test.afterAll(() => viderComptes());

  test("npm run lien-secours affiche un lien qui connecte Océane, une seule fois", async ({ page, browser, baseURL }) => {
    const { lien, sortie } = lienDeSecours("--origine", baseURL!);
    expect(sortie).toContain(`Lien de secours pour ${OCEANE} (base locale)`);
    expect(sortie).toMatch(/Valable 10 minutes \(jusqu'à \d{2}:\d{2}\), une seule fois/);

    // En base : l'empreinte du jeton, jamais le jeton lui-même.
    const jeton = new URL(lien).searchParams.get("token")!;
    const [ligne] = lignesLocales<{ identifier: string }>("SELECT identifier FROM verification");
    expect(ligne.identifier).toMatch(/^magic-link:[A-Za-z0-9_-]{43}$/);
    expect(ligne.identifier).not.toContain(jeton);

    await page.goto(lien);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("connectee")).toHaveText(`Connectée avec ${OCEANE}.`);
    expect(compterLignes("verification")).toBe(0); // consommé

    // Réutilisé, depuis un autre navigateur : refusé.
    const autre = await browser.newContext();
    const page2 = await autre.newPage();
    await page2.goto(lien);
    await expect(page2).toHaveURL(/\/admin\/connexion\?error=INVALID_TOKEN/);
    await expect(page2.getByRole("main").getByRole("alert")).toHaveText(EXPIRE);
    await autre.close();
  });

  test("passé 10 minutes, le lien de secours est refusé", async ({ page, baseURL }) => {
    const { lien } = lienDeSecours("--origine", baseURL!);
    sqlLocal(`UPDATE verification SET expires_at = ${Date.now() - 1000};`);
    await page.goto(lien);
    await expect(page).toHaveURL(/\/admin\/connexion\?error=INVALID_TOKEN/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(EXPIRE);
    expect(compterLignes("session")).toBe(0);
  });

  test("avec une autre adresse que celle d'Océane, le lien n'ouvre aucune session", async ({ page, baseURL }) => {
    const { lien } = lienDeSecours("--origine", baseURL!, "--email", "intrus@exemple.test");
    await page.goto(lien);
    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page).toHaveURL(/\/admin\/connexion/);
    expect(compterLignes("session")).toBe(0);
    expect(compterLignes("user")).toBe(0);
  });
});
