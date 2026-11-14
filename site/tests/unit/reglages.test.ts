import { describe, expect, it } from "vitest";
import { lienVisioSur, reglagesDepuisBase, validerReglages } from "@/lib/reglages";

// T21 · Réglages d'Océane (specs/SPEC-emails-client.md).

describe("lienVisioSur", () => {
  it("accepte une adresse https avec un nom de domaine", () => {
    expect(lienVisioSur(" https://meet.google.com/abc-defg-hij ")).toBe("https://meet.google.com/abc-defg-hij");
    expect(lienVisioSur("https://zoom.us/j/123456789?pwd=abc")).toBe("https://zoom.us/j/123456789?pwd=abc");
  });

  it("refuse tout ce qui n'est pas une adresse web sûre", () => {
    for (const mauvais of [
      "",
      "meet.google.com/abc",
      "http://meet.google.com/abc",
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
      "https://utilisateur:mot-de-passe@meet.google.com/abc",
      "https://localhost/abc",
      "https://exemple.fr/une salle",
      `https://exemple.fr/${"a".repeat(300)}`,
    ]) {
      expect(lienVisioSur(mauvais), mauvais.slice(0, 30)).toBeNull();
    }
  });
});

describe("validerReglages", () => {
  it("lien et durée valides, durée en texte", () => {
    expect(validerReglages({ lienVisio: "https://meet.google.com/abc", dureeMinutes: " 90 " })).toEqual({
      ok: true,
      reglages: { lienVisio: "https://meet.google.com/abc", dureeMinutes: 90 },
    });
  });

  it("lien vide permis (pas de visio réglée)", () => {
    expect(validerReglages({ lienVisio: "  ", dureeMinutes: "60" })).toEqual({ ok: true, reglages: { lienVisio: "", dureeMinutes: 60 } });
  });

  it("chaque champ fautif est signalé", () => {
    const v = validerReglages({ lienVisio: "http://x.fr", dureeMinutes: "5" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(Object.keys(v.erreurs).sort()).toEqual(["dureeMinutes", "lienVisio"]);
    for (const d of ["14", "241", "abc", "", "60.5", "-30"]) expect(validerReglages({ lienVisio: "", dureeMinutes: d }).ok, d).toBe(false);
    for (const d of ["15", "240"]) expect(validerReglages({ lienVisio: "", dureeMinutes: d }).ok, d).toBe(true);
  });
});

describe("reglagesDepuisBase", () => {
  it("valeurs de départ : pas de lien, 60 minutes", () => {
    expect(reglagesDepuisBase([])).toEqual({ lienVisio: "", dureeMinutes: 60 });
  });

  it("lit la base, et écarte ce qui n'est plus valable", () => {
    expect(reglagesDepuisBase([{ cle: "lien_visio", valeur: "https://meet.google.com/abc" }, { cle: "duree_minutes", valeur: "45" }])).toEqual({
      lienVisio: "https://meet.google.com/abc",
      dureeMinutes: 45,
    });
    expect(reglagesDepuisBase([{ cle: "lien_visio", valeur: "javascript:alert(1)" }, { cle: "duree_minutes", valeur: "9999" }])).toEqual({
      lienVisio: "",
      dureeMinutes: 60,
    });
  });
});
