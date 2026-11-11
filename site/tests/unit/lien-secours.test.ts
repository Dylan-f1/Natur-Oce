import { describe, expect, it } from "vitest";
import {
  DUREE_SECONDES,
  identifiantStocke,
  jetonAleatoire,
  ligneVerification,
  origineAcceptee,
  sqlInsertion,
  urlLienSecours,
} from "@/lib/auth/lien-secours";

// T13 · Lien de connexion de secours (specs/SPEC-connexion.md, R-15) : mêmes règles que les liens
// de Better Auth (plugin magicLink, storeToken « hashed »), pour que sa route de vérification
// l'accepte tel quel.

describe("jetonAleatoire", () => {
  it("32 lettres a-z A-Z, comme Better Auth", () => {
    const jeton = jetonAleatoire();
    expect(jeton).toMatch(/^[a-zA-Z]{32}$/);
  });

  it("deux jetons ne se ressemblent pas", () => {
    expect(new Set(Array.from({ length: 50 }, () => jetonAleatoire())).size).toBe(50);
  });

  it("sans biais : les octets hors de 0 à 207 sont rejetés, pas ramenés par modulo", () => {
    const suite = [208, 255, 0, 51, 52, 207];
    let i = 0;
    const faux = (n: number) => Uint8Array.from({ length: n }, () => suite[i++ % suite.length]);
    // 0 → a, 51 → Z, 52 → a, 207 → Z (207 % 52 = 51) ; 208 et 255 ignorés
    expect(jetonAleatoire(faux).slice(0, 4)).toBe("aZaZ");
  });
});

describe("identifiantStocke", () => {
  it("« magic-link: » + SHA-256 en base64url sans remplissage (defaultKeyHasher de Better Auth)", async () => {
    // Vecteur connu : SHA-256("abc") = ba7816bf…15ad
    expect(await identifiantStocke("abc")).toBe("magic-link:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });
});

describe("ligneVerification et sqlInsertion", () => {
  const maintenant = Date.parse("2026-11-11T10:00:00Z");

  it("valable 10 minutes, pour l'adresse donnée (normalisée), au format de Better Auth", async () => {
    const ligne = await ligneVerification({ jeton: "abc", email: " Oceane@Exemple.test ", maintenant, id: "id-1" });
    expect(DUREE_SECONDES).toBe(600);
    expect(ligne).toEqual({
      id: "id-1",
      identifier: "magic-link:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0",
      value: JSON.stringify({ type: "magic-link", email: "oceane@exemple.test", name: "" }),
      expiresAt: maintenant + 600_000,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
  });

  it("refuse une adresse invalide", async () => {
    await expect(ligneVerification({ jeton: "abc", email: "pas une adresse", maintenant, id: "x" })).rejects.toThrow(/adresse/);
  });

  it("le SQL d'insertion échappe les apostrophes et ne contient jamais le jeton en clair", async () => {
    const ligne = await ligneVerification({ jeton: "JetonSecretABC", email: "o'brien@exemple.test", maintenant, id: "id-2" });
    const sql = sqlInsertion(ligne);
    expect(sql).toMatch(/^INSERT INTO verification \(id, identifier, value, expires_at, created_at, updated_at\) VALUES \(/);
    expect(sql).toContain("o''brien@exemple.test");
    expect(sql).not.toContain("JetonSecretABC");
  });
});

describe("urlLienSecours et origineAcceptee", () => {
  it("même adresse que les liens envoyés par e-mail : retour sur /admin, erreurs sur la connexion", () => {
    const url = new URL(urlLienSecours("https://natur-oce.fr", "abc"));
    expect(url.origin + url.pathname).toBe("https://natur-oce.fr/api/auth/magic-link/verify");
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("callbackURL")).toBe("/admin");
    expect(url.searchParams.get("errorCallbackURL")).toBe("/admin/connexion");
  });

  it("seules les origines de confiance du site sont acceptées", () => {
    for (const o of ["https://natur-oce.fr", "https://natur-oce.df-dev.workers.dev", "http://127.0.0.1:8790", "http://localhost:8790"]) {
      expect(origineAcceptee(o), o).toBe(true);
    }
    for (const o of ["http://natur-oce.fr", "https://natur-oce.fr/", "https://evil.example", "https://natur-oce.fr.evil.example", ""]) {
      expect(origineAcceptee(o), o).toBe(false);
    }
  });
});
