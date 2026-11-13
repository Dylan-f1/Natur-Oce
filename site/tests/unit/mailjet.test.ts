import { describe, expect, it } from "vitest";
import { corpsMailjet, lireConfigMailjet } from "@/lib/email/mailjet";
import { modeleAccuseReception, prenomSur } from "@/lib/email/modeles";

// T20 · Accusé de réception par Mailjet (specs/SPEC-emails-client.md).

describe("lireConfigMailjet", () => {
  it("sans clés : envoi désactivé, sans erreur", () => {
    expect(lireConfigMailjet({})).toBeNull();
    expect(lireConfigMailjet({ MAILJET_API_KEY: "a" })).toBeNull();
  });

  it("API Mailjet par défaut ; faux Mailjet local accepté ; toute autre adresse refusée", () => {
    expect(lireConfigMailjet({ MAILJET_API_KEY: "a", MAILJET_API_SECRET: "b" })).toEqual({ cle: "a", secret: "b", api: "https://api.mailjet.com" });
    expect(lireConfigMailjet({ MAILJET_API_KEY: "a", MAILJET_API_SECRET: "b", MAILJET_API_URL: "http://127.0.0.1:8797" })?.api).toBe("http://127.0.0.1:8797");
    expect(() => lireConfigMailjet({ MAILJET_API_KEY: "a", MAILJET_API_SECRET: "b", MAILJET_API_URL: "https://pirate.example" })).toThrow(/refusée/);
  });
});

describe("corpsMailjet", () => {
  it("expéditeur et réponse vers contact@, suivi coupé", () => {
    const [m] = corpsMailjet({ destinataire: { email: "lea@exemple.test", nom: "Léa" }, sujet: "S", texte: "T", html: "<p>H</p>" }).Messages;
    expect(m.From).toEqual({ Email: "contact@natur-oce.fr", Name: "Océane — Natur’Océ" });
    expect(m.ReplyTo.Email).toBe("contact@natur-oce.fr");
    expect(m.To).toEqual([{ Email: "lea@exemple.test", Name: "Léa" }]);
    expect([m.TrackOpens, m.TrackClicks]).toEqual(["disabled", "disabled"]);
  });
});

describe("accusé de réception", () => {
  it("prénom repris seulement s'il n'est fait que de lettres", () => {
    expect(prenomSur(" Léa ")).toBe("Léa");
    expect(prenomSur("Anne-Sophie")).toBe("Anne-Sophie");
    expect(prenomSur("N’Golo")).toBe("N’Golo");
    expect(prenomSur("Léa www.spam.fr")).toBeNull();
    expect(prenomSur("Léa <b>")).toBeNull();
    expect(prenomSur("x".repeat(41))).toBeNull();
  });

  it("ne recopie que le prénom sûr et le créneau", () => {
    const m = modeleAccuseReception({ prenom: "Léa", disponibilites: "mercredi 18 novembre 2026 à 18 h 30" });
    expect(m.texte.startsWith("Bonjour Léa,")).toBe(true);
    expect(m.texte).toContain("Créneau demandé : mercredi 18 novembre 2026 à 18 h 30");
    expect(m.html).toContain("background:#3D491B");
    expect(m.nom).toBe("Léa");
    const sans = modeleAccuseReception({ prenom: "<script>", disponibilites: undefined });
    expect(sans.texte.startsWith("Bonjour,")).toBe(true);
    expect(sans.texte).not.toContain("Créneau");
    expect(sans.html).not.toContain("<script>");
  });
});
