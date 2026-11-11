import { describe, expect, it } from "vitest";
import { TARIFS_MAX, formaterDuree, formaterPrix, lirePrix, prixPourSaisie, validerTarifs } from "@/lib/tarifs";

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

describe("validerTarifs (liste saisie dans /admin/tarifs, EF-12)", () => {
  const ligne = (libelle: string, duree: string, prix: string, id = `id-${libelle}`) => ({ id, libelle, duree, prix });
  let compteur = 0;
  const nouvelId = () => `neuf-${++compteur}`;

  it("convertit chaque ligne et garde l'ordre de la saisie", () => {
    const r = validerTarifs([ligne("Bilan", "90", "75"), ligne("Suivi", "", "62,50")], nouvelId);
    expect(r).toEqual({
      ok: true,
      tarifs: [
        { id: "id-Bilan", libelle: "Bilan", dureeMinutes: 90, prixCentimes: 7500, ordre: 0 },
        { id: "id-Suivi", libelle: "Suivi", dureeMinutes: null, prixCentimes: 6250, ordre: 1 },
      ],
    });
  });

  it("une liste vide est permise (l'accueil affiche « Tarifs sur demande »)", () => {
    expect(validerTarifs([], nouvelId)).toEqual({ ok: true, tarifs: [] });
  });

  it("retire les espaces du libellé ; un libellé vide ou trop long est signalé sur sa ligne", () => {
    const r = validerTarifs([ligne("  Bilan  ", "90", "75"), ligne("   ", "60", "50"), ligne("x".repeat(81), "", "50")], nouvelId);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs).toEqual({
      1: { libelle: "Donnez un nom à cette séance." },
      2: { libelle: "Le nom dépasse 80 caractères." },
    });
  });

  it.each([["-5"], ["1000"], ["douze"], [""], ["62,555"]])("prix « %s » → ligne signalée, rien d'accepté", (prix) => {
    const r = validerTarifs([ligne("Bilan", "90", "75"), ligne("Suivi", "45", prix)], nouvelId);
    expect(r).toEqual({ ok: false, erreurs: { 1: { prix: "Prix en euros entre 0 et 999, par exemple 62,50." } } });
  });

  it.each([["0"], ["4"], ["601"], ["1,5"], ["une heure"]])("durée « %s » → ligne signalée", (duree) => {
    const r = validerTarifs([ligne("Bilan", duree, "75")], nouvelId);
    expect(r).toEqual({ ok: false, erreurs: { 0: { duree: "Durée en minutes, entre 5 et 600 (par exemple 90), ou vide." } } });
  });

  it("plusieurs erreurs sur une même ligne sont toutes signalées", () => {
    const r = validerTarifs([ligne("", "2", "abc")], nouvelId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erreurs[0]).sort()).toEqual(["duree", "libelle", "prix"]);
  });

  it(`au-delà de ${TARIFS_MAX} lignes, la liste est refusée`, () => {
    const trop = Array.from({ length: TARIFS_MAX + 1 }, (_, i) => ligne(`S${i}`, "60", "50"));
    const r = validerTarifs(trop, nouvelId);
    expect(r).toMatchObject({ ok: false, general: `${TARIFS_MAX} tarifs au plus.` });
  });

  it("un identifiant absent, mal formé ou en double est remplacé par un neuf", () => {
    const r = validerTarifs([ligne("A", "", "1", "bon-id"), ligne("B", "", "2", "bon-id"), ligne("C", "", "3", "../x"), ligne("D", "", "4", "")], nouvelId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.tarifs.map((t) => t.id);
    expect(ids[0]).toBe("bon-id");
    expect(new Set(ids).size).toBe(4);
    expect(ids.slice(1).every((id) => id.startsWith("neuf-"))).toBe(true);
  });
});

describe("prixPourSaisie", () => {
  it.each([[7500, "75"], [6250, "62,50"], [6205, "62,05"], [0, "0"], [99_900, "999"]])("%i centimes → « %s », relu à l'identique", (centimes, attendu) => {
    expect(prixPourSaisie(centimes)).toBe(attendu);
    expect(lirePrix(prixPourSaisie(centimes))).toBe(centimes);
  });
});
