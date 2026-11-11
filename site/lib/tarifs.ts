// Formats des tarifs (specs/SPEC-tarifs.md) : logique pure, testée dans tests/unit/tarifs.test.ts.

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurosRonds = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** 7500 → « 75 € » ; 6250 → « 62,50 € » (espace insécable avant €, format français). */
export function formaterPrix(centimes: number): string {
  return centimes % 100 === 0 ? eurosRonds.format(centimes / 100) : euros.format(centimes / 100);
}

/** 90 → « 1 h 30 » ; 60 → « 1 h » ; 45 → « 45 min ». */
export function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Saisie d'Océane → centimes. Accepte « 75 », « 62,50 », « 62.5 », « 75 € ».
 * Renvoie null si la saisie n'est pas un prix entre 0 et 999 €.
 */
export function lirePrix(saisie: string): number | null {
  const nettoye = saisie.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(nettoye)) return null;
  const centimes = Math.round(Number(nettoye) * 100);
  return centimes >= 0 && centimes <= 99_900 ? centimes : null;
}
