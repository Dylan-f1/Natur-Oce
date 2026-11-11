import { expect, test } from "@playwright/test";
import { compterLignes } from "./outils/d1";
import { MESSAGE_ENVOYE, demanderLien, seConnecter, viderComptes, viderLimites } from "./outils/connexion";

// T5 · /admin protégé, déconnexion, limite de demandes (specs/SPEC-connexion.md, ENF-03).
// Routes d'administration à balayer : à compléter à chaque nouvelle page (T7, T9, T11…).
const ROUTES_ADMIN = ["/admin"];

test.describe.configure({ mode: "serial" });

test.describe("Administration protégée", () => {
  test.beforeAll(viderComptes);
  test.afterAll(viderComptes);

  test("sans cookie, chaque route d'administration renvoie vers la connexion (proxy)", async ({ request }) => {
    for (const route of ROUTES_ADMIN) {
      const reponse = await request.get(route, { maxRedirects: 0 });
      expect(reponse.status(), route).toBe(307);
      expect(reponse.headers().location, route).toMatch(/\/admin\/connexion$/);
    }
  });

  test("avec un faux cookie, la vérification serveur renvoie quand même vers la connexion (ENF-03)", async ({ page, context }) => {
    await context.addCookies([
      { name: "natur-oce.session_token", value: "faux.jeton", domain: "127.0.0.1", path: "/" },
    ]);
    for (const route of ROUTES_ADMIN) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/admin\/connexion$/);
    }
  });

  test("« Se déconnecter » supprime la session en base et le cookie", async ({ page, context }) => {
    await seConnecter(page);
    expect(compterLignes("session")).toBe(1);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion\?deconnecte=1$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Vous êtes déconnectée.");
    expect(compterLignes("session")).toBe(0);
    expect((await context.cookies()).some((c) => c.name.endsWith("session_token") && c.value)).toBe(false);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("la route HTTP de demande de lien est fermée et n'enregistre rien (revue, point 2)", async ({ request }) => {
    viderLimites();
    const avant = compterLignes("verification");
    const reponse = await request.post("/api/auth/sign-in/magic-link", {
      data: { email: "quelquun@exemple.test" },
      headers: { origin: "http://127.0.0.1:8791" },
    });
    expect(reponse.status()).toBe(404);
    expect(compterLignes("verification")).toBe(avant);
  });

  test("le limiteur de Better Auth refuse au-delà de 60 requêtes par minute et par IP (revue, point 3)", async ({ request }) => {
    viderLimites();
    // IP de documentation (RFC 5737) : sans IP, Better Auth ne limite pas, d'où ce test explicite.
    const entetes = { "cf-connecting-ip": "203.0.113.7" };
    const statuts: number[] = [];
    for (let i = 0; i < 62; i++) {
      statuts.push((await request.get("/api/auth/get-session", { headers: entetes })).status());
    }
    expect(statuts.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuts.at(-1)).toBe(429);
    expect(compterLignes("rate_limit")).toBeGreaterThan(0); // compteurs bien écrits dans D1
  });

  test("la 4e demande de lien en 15 min est refusée", async ({ page }) => {
    viderLimites();
    for (let i = 1; i <= 3; i++) {
      await demanderLien(page, "quelquun@exemple.test");
      await expect(page.getByRole("main").getByRole("status"), `demande ${i}`).toHaveText(MESSAGE_ENVOYE);
    }
    await demanderLien(page, "quelquun@exemple.test");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Trop de demandes. Réessayez dans 15 minutes.");
  });
});
