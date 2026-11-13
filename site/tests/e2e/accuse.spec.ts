import { expect, test, type APIRequestContext } from "@playwright/test";
import { viderLimites } from "./outils/connexion";
import { attendreEmail } from "./outils/emails";
import { envoisMailjet, reglerMailjet, reinitialiserMailjet } from "./outils/mailjet";

// T20 · Accusé de réception au visiteur par Mailjet (specs/SPEC-emails-client.md, EF-05).

test.describe.configure({ mode: "serial" });

const ORIGINE = "http://127.0.0.1:8791";

function demain(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + 86_400_000));
}

function demander(request: APIRequestContext, champs: Partial<Record<"prenom" | "email" | "jour" | "heure" | "message" | "site", string>>) {
  return request.post("/api/contact", {
    form: { prenom: "Léa", email: "lea@exemple.test", jour: "", heure: "", message: "Bonjour, je prépare un semi-marathon.", site: "", ...champs },
    headers: { origin: ORIGINE, accept: "application/json" },
  });
}

test.describe("Accusé de réception", () => {
  test.beforeEach(async () => {
    viderLimites();
    await reinitialiserMailjet();
  });
  test.afterAll(async () => {
    viderLimites();
    await reinitialiserMailjet();
  });

  test("Given une demande valide, Then le visiteur reçoit l'accusé par Mailjet, sans son message recopié (EF-05)", async ({ request }) => {
    const depuis = Date.now();
    const reponse = await demander(request, { jour: demain(), heure: "18:30" });
    expect(await reponse.json()).toEqual({ ok: true });
    expect(await attendreEmail(depuis)).toContain("Bonjour, je prépare un semi-marathon."); // Océane la reçoit toujours

    const envois = await envoisMailjet();
    expect(envois).toHaveLength(1);
    const [m] = envois[0].corps.Messages;
    expect(envois[0].autorisation).toBe(`Basic ${Buffer.from("cle-de-test:secret-de-test").toString("base64")}`);
    expect(m.From.Email).toBe("contact@natur-oce.fr");
    expect(m.ReplyTo.Email).toBe("contact@natur-oce.fr");
    expect(m.To).toEqual([{ Email: "lea@exemple.test", Name: "Léa" }]);
    expect(m.Subject).toBe("Votre demande de séance est bien reçue");
    expect(m.TextPart).toMatch(/^Bonjour Léa,/);
    expect(m.TextPart).toMatch(/Créneau demandé : \S+ \d+ \S+ \d{4} à 18 h 30/);
    expect(m.TextPart).toContain("ne remplace pas un avis médical");
    expect(m.HTMLPart).toContain("https://natur-oce.fr/logo-email.png");
    expect(m.TrackOpens).toBe("disabled");
    for (const partie of [m.TextPart, m.HTMLPart]) expect(partie).not.toContain("semi-marathon"); // pas de relais de texte libre
  });

  test("un prénom qui n'est pas fait que de lettres n'est pas repris (« Bonjour, »)", async ({ request }) => {
    await demander(request, { prenom: "Léa www.spam.example" });
    const [m] = (await envoisMailjet())[0].corps.Messages;
    expect(m.TextPart).toMatch(/^Bonjour,\n/);
    expect(m.TextPart + m.HTMLPart).not.toContain("spam");
    expect(m.To).toEqual([{ Email: "lea@exemple.test" }]);
  });

  test("Mailjet en panne : la demande arrive quand même chez Océane, et la réponse est la même", async ({ request }) => {
    await reglerMailjet(500);
    const depuis = Date.now();
    const reponse = await demander(request, { message: "Malgré la panne de Mailjet." });
    expect(reponse.status()).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true });
    expect(await attendreEmail(depuis)).toContain("Malgré la panne de Mailjet.");
    expect(await envoisMailjet()).toHaveLength(1); // tenté une fois, sans bloquer
  });

  test("robot (champ piège rempli) ou demande invalide : aucun accusé", async ({ request }) => {
    await demander(request, { site: "https://spam.example" });
    expect((await demander(request, { email: "pas-une-adresse" })).status()).toBe(422);
    expect(await envoisMailjet()).toEqual([]);
  });
});
