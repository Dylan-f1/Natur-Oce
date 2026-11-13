import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { lignesLocales } from "./outils/d1";
import { viderLimites } from "./outils/connexion";
import { attendreEmail, emailsDepuis } from "./outils/emails";

// T12 · Demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, ENF-06, RSE-04).

test.describe.configure({ mode: "serial" });

const ORIGINE = "http://127.0.0.1:8791";
const CONFIRMATION = "Votre demande est envoyée.";

/** Demain à Paris, au format des champs date : toujours dans les bornes du calendrier. */
function demain(): string {
  const j = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + 86_400_000));
  return j;
}

async function remplir(page: Page, champs: { prenom?: string; email?: string; jour?: string; heure?: string; message?: string }) {
  const f = page.locator("#contact");
  if (champs.prenom !== undefined) await f.getByLabel("Prénom").fill(champs.prenom);
  if (champs.email !== undefined) await f.getByLabel("E-mail").fill(champs.email);
  if (champs.jour !== undefined) await f.getByLabel("Jour").fill(champs.jour);
  if (champs.heure !== undefined) await f.getByLabel("Heure").fill(champs.heure);
  if (champs.message !== undefined) await f.getByLabel("Votre message").fill(champs.message);
}

const envoyer = (page: Page) => page.locator("#contact").getByRole("button", { name: "Envoyer ma demande" }).click();

/** Envoi direct, comme le fait le formulaire avec JavaScript. */
function envoiDirect(request: APIRequestContext, prenom: string) {
  return request.post("/api/contact", {
    form: { prenom, email: "lea@exemple.test", jour: "", heure: "", message: "Bonjour.", site: "" },
    headers: { origin: ORIGINE, accept: "application/json" },
  });
}

test.describe("Demande de séance", () => {
  test.beforeEach(() => viderLimites());
  test.afterAll(() => viderLimites());

  test("Given un formulaire rempli, When le visiteur envoie, Then la confirmation remplace le formulaire et Océane reçoit la demande (EF-04)", async ({ page }) => {
    await page.goto("/#contact");
    await remplir(page, { prenom: "Léa", email: "lea@exemple.test", jour: demain(), heure: "18:30", message: "Bonjour, je prépare un semi-marathon." });
    const depuis = Date.now();
    await envoyer(page);

    const confirmation = page.locator("#contact").getByRole("status");
    await expect(confirmation).toContainText(CONFIRMATION);
    await expect(confirmation).toBeFocused(); // annoncée et reprise au clavier
    await expect(page.locator("#contact form")).toHaveCount(0);

    const texte = await attendreEmail(depuis);
    expect(texte).toContain("Nouvelle demande de séance de Léa (lea@exemple.test).");
    expect(texte).toMatch(/Disponibilités : \S+ \d+ \S+ \d{4} à 18 h 30/);
    expect(texte).toContain("Bonjour, je prépare un semi-marathon.");
  });

  test("aucune donnée du visiteur n'est gardée : seulement des empreintes (IP, compteur du jour des accusés), sans adresse ni texte (RSE-04)", async ({ request }) => {
    expect((await envoiDirect(request, "Léa")).status()).toBe(200);
    const lignes = lignesLocales<{ cle: string }>("SELECT cle FROM limite");
    expect(lignes).toHaveLength(2); // limite par IP + plafond quotidien des accusés de réception (T20)
    for (const { cle } of lignes) {
      expect(cle).toMatch(/^[0-9a-f]{64}$/); // HMAC-SHA-256
      expect(cle).not.toMatch(/127\.0\.0\.1|lea@|Bonjour/);
    }
  });

  test("champs vides ou adresse invalide → chaque champ fautif est signalé, la saisie est conservée, rien ne part", async ({ page }) => {
    await page.goto("/#contact");
    const depuis = Date.now();
    await envoyer(page);
    const f = page.locator("#contact");
    await expect(f.getByText("Indiquez votre prénom.")).toBeVisible();
    await expect(f.getByText("Écrivez quelques mots sur votre demande.")).toBeVisible();
    await expect(f.getByLabel("Prénom")).toHaveAttribute("aria-invalid", "true");
    await expect(f.getByLabel("Prénom")).toBeFocused(); // premier champ fautif

    await remplir(page, { prenom: "Léa", email: "lea@", message: "Mon message." });
    await envoyer(page);
    await expect(f.getByText("Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.")).toBeVisible();
    await expect(f.getByText("Indiquez votre prénom.")).toHaveCount(0);
    await expect(f.getByLabel("E-mail")).toBeFocused();
    await expect(f.getByLabel("Votre message")).toHaveValue("Mon message.");
    expect(emailsDepuis(depuis)).toBe(0);
  });

  test("les champs obligatoires portent un astérisque ; un champ mal rempli s'encadre en rouge dès qu'on le quitte, et se corrige en direct", async ({ page }) => {
    await page.goto("/#contact");
    const f = page.locator("#contact");
    await expect(f.getByText("Champ obligatoire")).toBeVisible();
    await expect(f.locator("label .obligatoire")).toHaveCount(3); // prénom, e-mail, message
    await expect(f.getByLabel("Prénom")).toHaveAttribute("required", "");

    await f.getByLabel("E-mail").fill("lea@");
    await f.getByLabel("Votre message").focus(); // quitter le champ
    await expect(f.getByText("Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.")).toBeVisible();
    const bordure = await f.getByLabel("E-mail").evaluate((e) => getComputedStyle(e).borderTopColor);
    expect(bordure).toBe("rgb(179, 38, 30)");
    await f.getByLabel("E-mail").fill("lea@exemple.test");
    await expect(f.getByText("Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.")).toHaveCount(0);
    await expect(f.getByLabel("E-mail")).not.toHaveAttribute("aria-invalid", "true");

    await f.getByLabel("Heure").fill("07:00");
    await f.getByLabel("Votre message").focus();
    await expect(f.getByText("Choisissez une heure entre 8 h et 20 h.")).toBeVisible();
  });

  test("le champ piège est invisible et hors du parcours clavier ; rempli, il donne la même confirmation sans rien envoyer (ENF-04)", async ({ page }) => {
    await page.goto("/#contact");
    const piege = page.locator("#contact-site");
    await expect(piege).toHaveAttribute("tabindex", "-1");
    expect(await piege.evaluate((e) => e.getBoundingClientRect().right < 0)).toBe(true);

    await remplir(page, { prenom: "Robot", email: "robot@exemple.test", message: "Achetez maintenant" });
    await piege.evaluate((e) => ((e as HTMLInputElement).value = "https://spam.example"));
    const depuis = Date.now();
    await envoyer(page);
    await expect(page.locator("#contact").getByRole("status")).toContainText(CONFIRMATION);
    await page.waitForTimeout(1500); // laisser le temps à un éventuel e-mail
    expect(emailsDepuis(depuis)).toBe(0);
    expect(lignesLocales("SELECT cle FROM limite")).toHaveLength(0); // pas même compté
  });

  test("au 6e envoi dans l'heure, la demande est refusée avec un message clair (ENF-04)", async ({ page, request }) => {
    for (let i = 1; i <= 5; i++) expect((await envoiDirect(request, `Essai ${i}`)).status(), `envoi ${i}`).toBe(200);
    await page.goto("/#contact");
    await remplir(page, { prenom: "Léa", email: "lea@exemple.test", message: "Encore moi." });
    await envoyer(page);
    await expect(page.locator("#contact").getByRole("alert")).toHaveText("Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.");
    await expect(page.locator("#contact").getByLabel("Votre message")).toHaveValue("Encore moi.");
  });

  test("un envoi démesuré est refusé avant d'être lu, sans rien envoyer (revue)", async ({ request }) => {
    const depuis = Date.now();
    const reponse = await request.post("/api/contact", {
      form: { prenom: "Léa", email: "lea@exemple.test", jour: "", heure: "", message: "x".repeat(20_000), site: "" },
      headers: { origin: ORIGINE, accept: "application/json" },
    });
    expect(reponse.status()).toBe(413);
    expect(emailsDepuis(depuis)).toBe(0);
    expect(lignesLocales("SELECT cle FROM limite")).toHaveLength(0); // pas même compté
  });

  test("un envoi depuis un autre site est refusé", async ({ request }) => {
    const reponse = await request.post("/api/contact", {
      form: { prenom: "X", email: "x@exemple.test", jour: "", heure: "", message: "x", site: "" },
      headers: { origin: "https://exemple.test", accept: "application/json" },
    });
    expect(reponse.status()).toBe(403);
  });

  test("les champs sont à 16 px au moins (pas de zoom sur iPhone) et aucun ne parle de santé (RSE-04)", async ({ page }) => {
    await page.goto("/");
    const tailles = await page.locator("#contact input:not([name='site']), #contact textarea").evaluateAll((els) =>
      els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
    expect(tailles).toHaveLength(5); // prénom, e-mail, jour, heure, message
    for (const t of tailles) expect(t).toBeGreaterThanOrEqual(16);
    const libelles = await page.locator("#contact label").allTextContents();
    expect(libelles.join(" ")).not.toMatch(/santé|symptôme|traitement|maladie/i);
  });

  test("replié au départ : « Demander une séance » l'ouvre et place le curseur dans le prénom", async ({ page }) => {
    await page.goto("/");
    const formulaire = page.locator("#formulaire-contact");
    const bouton = page.locator("#contact").getByRole("button", { name: "Demander une séance" });
    await expect(formulaire).toBeHidden();
    await expect(bouton).toHaveAttribute("aria-expanded", "false");
    await bouton.click();
    await expect(formulaire).toBeVisible();
    await expect(bouton).toHaveCount(0);
    await expect(page.locator("#contact-prenom")).toBeFocused();
  });

  test("les autres « Demander une séance » de la page ouvrent aussi le formulaire, sans placer le curseur", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "Demander une séance" }).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.locator("#formulaire-contact")).toBeVisible();
    await expect(page.locator("#contact-prenom")).not.toBeFocused(); // pas de clavier qui surgit sur téléphone
  });

  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("le formulaire est ouvert d'emblée, sans bouton qui ne ferait rien", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#formulaire-contact")).toBeVisible();
      await expect(page.locator(".ouvrir-contact")).toBeHidden();
    });

    test("le navigateur bloque un envoi incomplet ; complet, il mène à la page de confirmation", async ({ page }) => {
      await page.goto("/");
      await envoyer(page);
      await expect(page).toHaveURL(/127\.0\.0\.1:8791\/$/); // resté sur l'accueil
      expect(await page.locator("#contact-prenom").evaluate((e) => (e as HTMLInputElement).validity.valueMissing)).toBe(true);

      // « lea@exemple » passe la règle HTML de base, pas celle du site : le motif la refuse (revue).
      await remplir(page, { prenom: "Léa", email: "lea@exemple", message: "Bonjour sans JavaScript." });
      await envoyer(page);
      await expect(page).toHaveURL(/127\.0\.0\.1:8791\/$/);
      expect(await page.locator("#contact-email").evaluate((e) => (e as HTMLInputElement).validity.patternMismatch)).toBe(true);

      await remplir(page, { email: "lea@exemple.test" });
      const depuis = Date.now();
      await envoyer(page);
      await expect(page).toHaveURL(/\/contact\/envoyee$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Votre demande est envoyée");
      expect(await attendreEmail(depuis)).toContain("Bonjour sans JavaScript.");
    });

    test("limite atteinte → page « pas partie », qui dit comment revenir à sa saisie", async ({ page, request }) => {
      for (let i = 1; i <= 5; i++) await envoiDirect(request, `Essai ${i}`);
      await page.goto("/");
      await remplir(page, { prenom: "Léa", email: "lea@exemple.test", message: "Encore." });
      await envoyer(page);
      await expect(page).toHaveURL(/\/contact\/non-envoyee$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Votre demande n’est pas partie");
      await expect(page.getByText("votre message y est encore")).toBeVisible();
    });
  });

  test("sur l'accueil figé (servi en fichier, comme en ligne), le formulaire envoie toujours (D-21)", async ({ page, request, baseURL }) => {
    test.setTimeout(90_000); // fige l'accueil avec un second serveur, puis le nettoie
    const instantane = (...args: string[]) =>
      execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(__dirname, "..", "..", "scripts", "instantane.ts"), ...args], {
        cwd: join(__dirname, "..", ".."), stdio: "pipe", encoding: "utf8",
      });
    instantane("--serveur", baseURL!);
    try {
      await expect.poll(async () => (await request.get("/")).text(), { timeout: 30_000 }).toContain('name="instantane"');
      expect((await request.post("/", { form: { prenom: "x" } })).status()).toBe(405); // la raison de /api/contact
      await page.goto("/#contact");
      await remplir(page, { prenom: "Léa", email: "lea@exemple.test", message: "Depuis l'accueil figé." });
      const depuis = Date.now();
      await envoyer(page);
      await expect(page.locator("#contact").getByRole("status")).toContainText(CONFIRMATION);
      expect(await attendreEmail(depuis)).toContain("Depuis l'accueil figé.");
    } finally {
      instantane("--nettoyer");
      await expect.poll(async () => (await request.get("/")).text(), { timeout: 30_000 }).not.toContain('name="instantane"');
    }
  });
});
