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

// ---------------------------------------------------------------------------------------------
// Liste saisie dans /admin/tarifs (T11, EF-12).

/** Au-delà, la ligne « Une séance » de l'accueil ne se lit plus. */
export const TARIFS_MAX = 12;
const LIBELLE_MAX = 80;
const ID = /^[A-Za-z0-9-]{1,64}$/;

/** Une ligne telle que saisie : tout en texte, comme dans les champs. */
export type LigneSaisie = { id: string; libelle: string; duree: string; prix: string };

export type TarifValide = { id: string; libelle: string; dureeMinutes: number | null; prixCentimes: number; ordre: number };

export type ErreursLigne = { libelle?: string; duree?: string; prix?: string };

export type VerdictTarifs =
  | { ok: true; tarifs: TarifValide[] }
  | { ok: false; erreurs: Record<number, ErreursLigne>; general?: string };

/** Durée saisie → minutes ; "" → null ; undefined si invalide. */
function lireDuree(saisie: string): number | null | undefined {
  const s = saisie.trim();
  if (s === "") return null;
  if (!/^\d{1,3}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 5 && n <= 600 ? n : undefined;
}

/**
 * Valide toute la liste : soit tout est bon et la liste est rendue prête à écrire (dans l'ordre
 * de la saisie), soit chaque ligne fautive est signalée et rien ne doit être écrit.
 */
export function validerTarifs(lignes: readonly LigneSaisie[], nouvelId: () => string = () => crypto.randomUUID()): VerdictTarifs {
  if (lignes.length > TARIFS_MAX) return { ok: false, erreurs: {}, general: `${TARIFS_MAX} tarifs au plus.` };

  const erreurs: Record<number, ErreursLigne> = {};
  const tarifs: TarifValide[] = [];
  const vus = new Set<string>();

  lignes.forEach((l, i) => {
    const e: ErreursLigne = {};
    const libelle = l.libelle.trim();
    if (libelle === "") e.libelle = "Donnez un nom à cette séance.";
    else if ([...libelle].length > LIBELLE_MAX) e.libelle = `Le nom dépasse ${LIBELLE_MAX} caractères.`;
    const duree = lireDuree(l.duree);
    if (duree === undefined) e.duree = "Durée en minutes, entre 5 et 600 (par exemple 90), ou vide.";
    const prix = lirePrix(l.prix);
    if (prix === null) e.prix = "Prix en euros entre 0 et 999, par exemple 62,50.";

    if (Object.keys(e).length > 0) {
      erreurs[i] = e;
      return;
    }
    const id = ID.test(l.id) && !vus.has(l.id) ? l.id : nouvelId();
    vus.add(id);
    tarifs.push({ id, libelle, dureeMinutes: duree ?? null, prixCentimes: prix!, ordre: i });
  });

  return Object.keys(erreurs).length > 0 ? { ok: false, erreurs } : { ok: true, tarifs };
}

/** Centimes → texte du champ de saisie : 7500 → « 75 », 6250 → « 62,50 ». */
export function prixPourSaisie(centimes: number): string {
  return centimes % 100 === 0 ? String(centimes / 100) : (centimes / 100).toFixed(2).replace(".", ",");
}
