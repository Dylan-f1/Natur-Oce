import { expect, test, type Page } from "@playwright/test";
import { compterLignes, sqlLocal } from "./outils/d1";
import { attendreEmail, emailsDepuis } from "./outils/emails";
import { MESSAGE_ENVOYE, OCEANE, demanderLien as demander, extraireLien, viderComptes } from "./outils/connexion";

// T4 · Lien de connexion par e-mail (specs/SPEC-connexion.md, ENF-03, D-18).

test.describe.configure({ mode: "serial" });

async function demanderLien(page: Page, adresse: string) {
  await demander(page, adresse);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(MESSAGE_ENVOYE);
}

test.describe("Connexion par lien e-mail", () => {
  test.beforeAll(viderComptes);
  test.afterAll(viderComptes);

  test("Given aucune session, When on ouvre /admin, Then on est redirigé vers la connexion", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  let lienUtilise = "";

  test("Given l'adresse d'Océane, When elle clique le lien reçu, Then elle arrive sur /admin, connectée", async ({ page, context }) => {
    const depuis = Date.now();
    await demanderLien(page, "  Oceane@Exemple.test ");
    const texte = await attendreEmail(depuis);
    expect(texte).toContain("valable 10 minutes");
    lienUtilise = extraireLien(texte);

    await page.goto(lienUtilise);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("connectee")).toHaveText(`Connectée avec ${OCEANE}.`);

    const cookie = (await context.cookies()).find((c) => c.name.endsWith("session_token"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("Given un lien déjà utilisé, When on le rouvre, Then « Ce lien a expiré »", async ({ page }) => {
    await page.goto(lienUtilise);
    await expect(page).toHaveURL(/\/admin\/connexion\?error=INVALID_TOKEN/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Ce lien a expiré. Demandez-en un nouveau.");
  });

  test("Given un lien de plus de 10 min, When on l'ouvre, Then « Ce lien a expiré »", async ({ page }) => {
    const depuis = Date.now();
    await demanderLien(page, OCEANE);
    const lien = extraireLien(await attendreEmail(depuis));
    sqlLocal(`UPDATE verification SET expires_at = ${Date.now() - 60_000};`); // vieilli de force
    await page.goto(lien);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Ce lien a expiré. Demandez-en un nouveau.");
  });

  test("Given une autre adresse, Then le même message s'affiche, aucun e-mail ne part, rien n'est stocké", async ({ page }) => {
    sqlLocal("DELETE FROM verification;");
    const depuis = Date.now();
    await demanderLien(page, "quelquun@exemple.test");
    await page.waitForTimeout(2500);
    expect(emailsDepuis(depuis)).toBe(0);
    expect(compterLignes("verification")).toBe(0); // l'adresse saisie n'est pas gardée en base
    const comptes = await page.request.get("/api/auth/get-session");
    expect(await comptes.json()).toBeNull();
  });
});
