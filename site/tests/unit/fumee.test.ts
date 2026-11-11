import { describe, expect, it } from "vitest";

// Test de fumée (T1) : vérifie que Vitest tourne et lit le TypeScript du projet.
// Les vrais tests unitaires arrivent avec la logique (T2 : formats de prix, T6 : rendu des articles).
describe("outillage", () => {
  it("exécute les tests unitaires", () => {
    expect(Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(62.5)).toMatch(
      /^62,50\s€$/,
    );
  });
});
