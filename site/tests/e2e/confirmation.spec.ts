import { expect, test, type APIRequestContext } from "@playwright/test";
import { lignesLocales, sqlLocal } from "./outils/d1";
import { seConnecter, viderComptes, viderLimites } from "./outils/connexion";
import { attendreEmail } from "./outils/emails";
import { envoisMailjet, reglerMailjet, reinitialiserMailjet } from "./outils/mailjet";

// T21 · Confirmer un rendez-vous en un clic (specs/SPEC-emails-client.md).

test.describe.configure({ mode: "serial" });

const ORIGINE = "http://127.0.0.1:8791";
const VISIO = "https://meet.google.com/abc-defg-hij";

function demain(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + 86_400_000));
}

const reglerVisio = () =>
  sqlLocal(`DELETE FROM reglage; INSERT INTO reglage (cle, valeur, modifie_le) VALUES ('lien_visio', '${VISIO}', 0), ('duree_minutes', '90', 0);`);

/** Une demande de séance avec créneau ; renvoie le lien de confirmation lu dans l'e-mail d'Océane. */
async function demanderEtLireLien(request: APIRequestContext): Promise<string> {
  const depuis = Date.now();
  const reponse = await request.post("/api/contact", {
    form: { prenom: "Léa", email: "lea@exemple.test", jour: demain(), heure: "18:30", message: "Bonjour, un rendez-vous ?", site: "" },
    headers: { origin: ORIGINE, accept: "application/json" },
  });
  expect(reponse.status()).toBe(200);
  const lien = (await attendreEmail(depuis)).match(/http:\/\/127\.0\.0\.1:\d+\/rendez-vous\/confirmer\?j=\S+/)?.[0];
  if (!lien) throw new Error("Pas de lien de confirmation dans l'e-mail d'Océane");
  return lien;
}

const jetonDe = (lien: string) => new URL(lien).searchParams.get("j")!;
const confirmationsEnvoyees = async () => (await envoisMailjet()).filter((e) => e.corps.Messages[0].Subject.startsWith("Votre séance est confirmée"));

test.describe("Confirmer un rendez-vous", () => {
  test.beforeEach(async () => {
    viderLimites();
    reglerVisio();
    await reinitialiserMailjet();
  });
  test.afterAll(async () => {
    viderLimites();
    sqlLocal("DELETE FROM reglage;");
    viderComptes();
    await reinitialiserMailjet();
  });

  test("Océane ouvre le lien (rien ne part), clique « Envoyer la confirmation » : le client reçoit le rendez-vous, une seule fois", async ({ page, request }) => {
    const lien = await demanderEtLireLien(request);
    expect(await envoisMailjet()).toHaveLength(1); // seulement l'accusé de réception du visiteur

    const reponse = await page.goto(lien);
    expect(reponse!.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "same-origin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirmer le rendez-vous de Léa ?");
    const etiquette = page.locator(".etiquette");
    await expect(etiquette).toContainText("lea@exemple.test");
    await expect(etiquette).toContainText("18 h 30");
    await expect(etiquette).toContainText("1 h 30");
    await expect(etiquette).toContainText(VISIO);
    expect(await envoisMailjet()).toHaveLength(1); // ouvrir la page n'a rien envoyé

    await page.getByRole("button", { name: "Envoyer la confirmation" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirmation envoyée");
    await expect(page).toHaveURL(/\/rendez-vous\/confirmer\?j=/);

    const envoyees = await confirmationsEnvoyees();
    expect(envoyees).toHaveLength(1);
    const [m] = envoyees[0].corps.Messages;
    expect(m.To).toEqual([{ Email: "lea@exemple.test", Name: "Léa" }]);
    expect(m.From.Email).toBe("contact@natur-oce.fr");
    expect(m.ReplyTo.Email).toBe("contact@natur-oce.fr");
    expect(m.Subject).toMatch(/^Votre séance est confirmée — \S+ \d+ \S+ \d{4} à 18 h 30$/);
    expect(m.HTMLPart).toContain("background:#3D491B");
    expect(m.HTMLPart).toContain(`href="${VISIO}"`);
    expect(m.TextPart).toContain(`Lien de la visio : ${VISIO}`);
    expect(m.TextPart).toContain("Durée : 1 h 30");
    expect(m.TrackOpens).toBe("disabled");
    const [pj] = m.Attachments!;
    expect(pj).toMatchObject({ Filename: "seance.ics", ContentType: "text/calendar" });
    const ics = Buffer.from(pj.Base64Content, "base64").toString("utf8");
    expect(ics).toContain("SUMMARY:Séance de naturopathie avec Océane");
    expect(ics).toContain(`URL:${VISIO}`);
    const debut = ics.match(/DTSTART:(\d{8}T\d{6})Z/)![1];
    const fin = ics.match(/DTEND:(\d{8}T\d{6})Z/)![1];
    expect(Number(fin.slice(9, 11)) * 60 + Number(fin.slice(11, 13)) - (Number(debut.slice(9, 11)) * 60 + Number(debut.slice(11, 13)))).toBe(90);

    // Revenir sur le lien : « envoyée », rien ne repart.
    await page.goto(lien);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirmation envoyée");
    expect(await confirmationsEnvoyees()).toHaveLength(1);
  });

  test("un deuxième envoi du même lien ne repart pas (double clic, lien partagé)", async ({ request }) => {
    const lien = await demanderEtLireLien(request);
    const poster = () => request.post("/api/rendez-vous/confirmer", { form: { j: jetonDe(lien) }, headers: { origin: ORIGINE }, maxRedirects: 0 });
    expect((await poster()).status()).toBe(303);
    expect((await poster()).status()).toBe(303);
    expect(await confirmationsEnvoyees()).toHaveLength(1);
  });

  test("Mailjet en panne : message d'erreur, rien n'est marqué envoyé, Océane peut réessayer", async ({ page, request }) => {
    const lien = await demanderEtLireLien(request);
    await reglerMailjet(500);
    await page.goto(lien);
    await page.getByRole("button", { name: "Envoyer la confirmation" }).click();
    await expect(page.getByRole("alert")).toContainText("La confirmation n’a pas pu partir");
    await expect(page.getByRole("button", { name: "Envoyer la confirmation" })).toBeVisible();

    await reglerMailjet(200);
    await page.getByRole("button", { name: "Envoyer la confirmation" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirmation envoyée");
    expect((await confirmationsEnvoyees()).filter((e) => e.corps.Messages[0].Subject.startsWith("Votre séance est confirmée"))).toHaveLength(2); // l'échec puis le succès
  });

  test("sans lien de visio réglé : la page renvoie vers les Réglages, rien ne part, même par un envoi direct", async ({ page, request }) => {
    const lien = await demanderEtLireLien(request);
    sqlLocal("DELETE FROM reglage;");
    await page.goto(lien);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indiquez d’abord votre lien de visio");
    await expect(page.getByRole("link", { name: "Ouvrir les Réglages" })).toHaveAttribute("href", "/admin/reglages");
    await request.post("/api/rendez-vous/confirmer", { form: { j: jetonDe(lien) }, headers: { origin: ORIGINE }, maxRedirects: 0 });
    expect(await confirmationsEnvoyees()).toHaveLength(0);
  });

  test("un envoi depuis un autre site est refusé", async ({ request }) => {
    const lien = await demanderEtLireLien(request);
    const reponse = await request.post("/api/rendez-vous/confirmer", { form: { j: jetonDe(lien) }, headers: { origin: "https://exemple.test" }, maxRedirects: 0 });
    expect(reponse.status()).toBe(403);
    expect(await confirmationsEnvoyees()).toHaveLength(0);
  });

  test("lien inventé, tronqué ou absent : « n'est plus valable », jamais de message d'erreur technique", async ({ page, request }) => {
    const lien = await demanderEtLireLien(request);
    for (const mauvais of ["/rendez-vous/confirmer", "/rendez-vous/confirmer?j=", "/rendez-vous/confirmer?j=v1.n-importe-quoi", `/rendez-vous/confirmer?j=${jetonDe(lien).slice(0, -6)}`]) {
      await page.goto(mauvais);
      await expect(page.getByRole("heading", { level: 1 }), mauvais).toHaveText("Ce lien n’est plus valable");
    }
    const post = await request.post("/api/rendez-vous/confirmer", { form: { j: "v1.n-importe-quoi" }, headers: { origin: ORIGINE }, maxRedirects: 0 });
    expect(post.status()).toBe(303);
    expect(await confirmationsEnvoyees()).toHaveLength(0);
  });

  test("sans créneau choisi : pas de lien de confirmation dans l'e-mail d'Océane (réponse pré-écrite)", async ({ request }) => {
    const depuis = Date.now();
    await request.post("/api/contact", {
      form: { prenom: "Léa", email: "lea@exemple.test", jour: "", heure: "", message: "Sans créneau.", site: "" },
      headers: { origin: ORIGINE, accept: "application/json" },
    });
    expect(await attendreEmail(depuis)).not.toContain("/rendez-vous/confirmer");
  });
});

test.describe("Réglages d'Océane", () => {
  test.beforeAll(() => viderComptes());
  test.beforeEach(() => sqlLocal("DELETE FROM reglage;"));
  test.afterAll(() => {
    viderComptes();
    sqlLocal("DELETE FROM reglage;");
  });

  test("elle enregistre son lien de visio et la durée ; un lien refusé n'écrit rien", async ({ page }) => {
    await seConnecter(page);
    await page.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Réglages" }).click();
    await expect(page).toHaveURL(/\/admin\/reglages$/);
    await expect(page.getByLabel("Durée d’une séance (minutes)")).toHaveValue("60"); // valeur de départ

    await page.getByLabel("Votre lien de visio").fill("http://pas-https.example/salle");
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(page.getByText("Collez l’adresse complète de votre salle de visio")).toBeVisible();
    expect(lignesLocales("SELECT cle FROM reglage")).toHaveLength(0);

    await page.getByLabel("Votre lien de visio").fill(VISIO);
    await page.getByLabel("Durée d’une séance (minutes)").fill("45");
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Les réglages sont enregistrés." })).toBeVisible();
    expect(lignesLocales<{ cle: string; valeur: string }>("SELECT cle, valeur FROM reglage ORDER BY cle")).toEqual([
      { cle: "duree_minutes", valeur: "45" },
      { cle: "lien_visio", valeur: VISIO },
    ]);
    await page.reload();
    await expect(page.getByLabel("Votre lien de visio")).toHaveValue(VISIO);
  });

  test("sans session, la page des réglages renvoie vers la connexion", async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();
    await page.goto("/admin/reglages");
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await contexte.close();
  });
});
