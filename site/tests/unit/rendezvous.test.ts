import { describe, expect, it } from "vitest";
import { VALIDITE_JETON_MS, creerJeton, creneauPasse, lireJeton } from "@/lib/rendezvous";

// T21 · Jeton de confirmation de rendez-vous (specs/SPEC-emails-client.md).

const SECRET = "un-secret-de-test-assez-long-pour-hmac-32+";
const AUTRE = "un-autre-secret-de-test-assez-long-pour-hmac!";
const rdv = { prenom: "Léa", email: "lea@exemple.test", jour: "2026-11-18", heure: "18:30" };
const T0 = Date.UTC(2026, 10, 14, 10, 0, 0);

describe("jeton de confirmation", () => {
  it("aller-retour : la demande ressort telle qu'elle est entrée", async () => {
    const jeton = await creerJeton(rdv, SECRET, T0);
    expect(jeton).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(await lireJeton(jeton, SECRET, T0 + 1000)).toEqual({ ok: true, rdv });
  });

  it("chiffré : ni l'adresse ni le prénom ne se lisent dans le lien", async () => {
    const jeton = await creerJeton(rdv, SECRET, T0);
    expect(jeton).not.toContain("lea");
    expect(jeton).not.toContain("exemple");
    expect(atob(jeton.slice(3).replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("exemple");
  });

  it("deux jetons de la même demande diffèrent (IV aléatoire)", async () => {
    expect(await creerJeton(rdv, SECRET, T0)).not.toBe(await creerJeton(rdv, SECRET, T0));
  });

  it("valable 7 jours, expiré ensuite", async () => {
    const jeton = await creerJeton(rdv, SECRET, T0);
    expect((await lireJeton(jeton, SECRET, T0 + VALIDITE_JETON_MS - 1)).ok).toBe(true);
    expect(await lireJeton(jeton, SECRET, T0 + VALIDITE_JETON_MS + 1)).toEqual({ ok: false, raison: "expire" });
  });

  it("falsifié, tronqué, mauvaise clé, mauvaise version ou n'importe quoi : invalide", async () => {
    const jeton = await creerJeton(rdv, SECRET, T0);
    const corps = jeton.slice(3);
    const falsifie = `v1.${corps.slice(0, 30)}${corps[30] === "A" ? "B" : "A"}${corps.slice(31)}`;
    for (const mauvais of [falsifie, jeton.slice(0, -4), `v2.${corps}`, `${jeton}.x`, "v1.", "v1.????", "", "n'importe quoi", "a".repeat(5000)]) {
      expect(await lireJeton(mauvais, SECRET, T0), mauvais.slice(0, 20)).toEqual({ ok: false, raison: "invalide" });
    }
    expect(await lireJeton(jeton, AUTRE, T0)).toEqual({ ok: false, raison: "invalide" });
  });

  it("refuse un secret trop court", async () => {
    await expect(creerJeton(rdv, "court", T0)).rejects.toThrow(/trop court/);
  });
});

describe("creneauPasse", () => {
  it("heure de Paris : 18 h 30 le 18 novembre = 17 h 30 UTC", () => {
    expect(creneauPasse("2026-11-18", "18:30", Date.UTC(2026, 10, 18, 17, 29))).toBe(false);
    expect(creneauPasse("2026-11-18", "18:30", Date.UTC(2026, 10, 18, 17, 31))).toBe(true);
  });
});
