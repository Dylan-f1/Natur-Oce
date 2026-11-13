// Formulaire de demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, RSE-04) : logique pure,
// testée dans tests/unit/contact.test.ts. Utilisée par le navigateur et par /api/contact.

import { adresseValide, type DemandeSeance } from "./email/modeles";

export const LIMITES_CONTACT = { prenom: 60, message: 1500 } as const;

/**
 * Créneau souhaité (demande de Dylan du 12/11) : un jour et une heure choisis dans le calendrier du
 * navigateur, facultatifs. Heures proposées de 8 h à 20 h (à ajuster avec Océane), jours
 * d'aujourd'hui à 6 mois, à l'heure de Paris.
 */
export const CRENEAU = { heureMin: "08:00", heureMax: "20:00", pasMinutes: 15, moisMax: 6 } as const;

/** 5 envois par heure et par adresse IP (ENF-04). */
export const LIMITE_ENVOIS = { max: 5, fenetreMs: 60 * 60 * 1000 } as const;

/**
 * Taille maximale d'un envoi, vérifiée avant de lire le corps (revue) : un message complet en fait
 * moins de 4 Ko ; au-delà, c'est un abus, refusé sans rien lire.
 */
export const TAILLE_MAX_DEMANDE = 16_384;

/**
 * Motif HTML du champ e-mail : la même règle que le serveur (adresseValide), pour que le
 * navigateur refuse lui-même « lea@exemple » même sans JavaScript (revue). Échappements valables
 * pour l'attribut `pattern` (drapeau v des navigateurs récents).
 */
export const MOTIF_EMAIL = String.raw`[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+`;

/** Nom du champ piège : invisible pour les visiteurs, rempli par les robots. */
export const CHAMP_PIEGE = "site";

export type ChampsContact = { prenom: string; email: string; jour: string; heure: string; message: string; site: string };
export type ErreursContact = Partial<Record<"prenom" | "email" | "jour" | "heure" | "message", string>>;

export type VerdictContact =
  | { statut: "valide"; demande: DemandeSeance }
  | { statut: "invalide"; erreurs: ErreursContact }
  | { statut: "robot" };

const longueur = (texte: string) => [...texte].length; // un emoji compte pour un caractère
const nombre = new Intl.NumberFormat("fr-FR");
const jourParis = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const jourEnLettres = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Bornes du calendrier, au format des champs date (AAAA-MM-JJ), à l'heure de Paris. */
export function bornesJour(maintenant: Date = new Date()): { min: string; max: string } {
  const min = jourParis.format(maintenant);
  const fin = new Date(`${min}T12:00:00Z`);
  fin.setUTCMonth(fin.getUTCMonth() + CRENEAU.moisMax);
  return { min, max: fin.toISOString().slice(0, 10) };
}

/** « 2026-11-18 », « 18:30 » → « mercredi 18 novembre 2026 à 18 h 30 ». */
export function creneauEnLettres(jour: string, heure: string): string {
  const [h, m] = heure.split(":");
  return `${jourEnLettres.format(new Date(`${jour}T12:00:00Z`))} à ${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
}

/** Erreurs du créneau ; les deux vides, c'est permis (facultatif). */
function verifierCreneau(jour: string, heure: string, maintenant: Date): ErreursContact {
  if (jour === "" && heure === "") return {};
  const e: ErreursContact = {};
  const { min, max } = bornesJour(maintenant);
  if (jour === "") e.jour = "Choisissez aussi le jour.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || Number.isNaN(Date.parse(`${jour}T12:00:00Z`)) || new Date(`${jour}T12:00:00Z`).toISOString().slice(0, 10) !== jour) {
    e.jour = "Choisissez un jour dans le calendrier.";
  } else if (jour < min) e.jour = "Choisissez un jour à partir d’aujourd’hui.";
  else if (jour > max) e.jour = `Choisissez un jour dans les ${CRENEAU.moisMax} prochains mois.`;
  if (heure === "") e.heure = "Indiquez aussi l’heure.";
  else if (!/^\d{2}:\d{2}$/.test(heure) || heure < CRENEAU.heureMin || heure > CRENEAU.heureMax) {
    e.heure = "Choisissez une heure entre 8 h et 20 h.";
  }
  return e;
}

export function validerDemande(champs: ChampsContact, maintenant: Date = new Date()): VerdictContact {
  if (champs.site.trim() !== "") return { statut: "robot" };

  const prenom = champs.prenom.trim();
  const email = champs.email.trim();
  const jour = champs.jour.trim();
  const heure = champs.heure.trim();
  const message = champs.message.trim();
  const erreurs: ErreursContact = {};

  if (prenom === "") erreurs.prenom = "Indiquez votre prénom.";
  else if (longueur(prenom) > LIMITES_CONTACT.prenom) erreurs.prenom = `Le prénom dépasse ${LIMITES_CONTACT.prenom} caractères.`;

  if (!adresseValide(email)) erreurs.email = "Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.";

  Object.assign(erreurs, verifierCreneau(jour, heure, maintenant));

  if (message === "") erreurs.message = "Écrivez quelques mots sur votre demande.";
  else if (longueur(message) > LIMITES_CONTACT.message) {
    const enTrop = longueur(message) - LIMITES_CONTACT.message;
    erreurs.message = `Le message dépasse ${nombre.format(LIMITES_CONTACT.message)} caractères (${nombre.format(enTrop)} en trop).`;
  }

  if (Object.keys(erreurs).length > 0) return { statut: "invalide", erreurs };
  return { statut: "valide", demande: { prenom, email, disponibilites: jour ? creneauEnLettres(jour, heure) : undefined, creneau: jour ? { jour, heure } : undefined, message } };
}
