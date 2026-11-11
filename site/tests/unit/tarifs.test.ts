import { describe, expect, it } from "vitest";
import { formaterDuree, formaterPrix, lirePrix } from "@/lib/tarifs";

// Intl sépare le montant et « € » par une espace fine insécable (U+202F).
const esp = /[   ]/.source;

describe("formaterPrix (EF-03)", () => {
  it("affiche les euros ronds sans décimales", () => {
    expect(formaterPrix(7500)).toMatch(new RegExp(`^75${esp}€$`));
  });
  it("affiche les centimes avec une virgule", () => {
    expect(formaterPrix(6250)).toMatch(new RegExp(`^62,50${esp}€$`));
  });
  it("affiche zéro", () => {
    expect(formaterPrix(0)).toMatch(new RegExp(`^0${esp}€$`));
  });
});

describe("formaterDuree", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30"],
    [75, "1 h 15"],
    [125, "2 h 05"],
  ])("%i minutes → %s", (minutes, attendu) => {
    expect(formaterDuree(minutes)).toBe(attendu);
  });
});

describe("lirePrix (saisie d'Océane, EF-12)", () => {
  it.each([
    ["75", 7500],
    ["62,50", 6250],
    ["62.5", 6250],
    ["75 €", 7500],
    [" 999 ", 99_900],
    ["0", 0],
  ])("« %s » → %i centimes", (saisie, attendu) => {
    expect(lirePrix(saisie)).toBe(attendu);
  });

  it.each(["-5", "1000", "abc", "", "62,505", "7 5 0 0"])("refuse « %s »", (saisie) => {
    expect(lirePrix(saisie)).toBeNull();
  });
});
