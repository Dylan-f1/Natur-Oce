// Formulaire de demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, RSE-04) : logique pure,
// testée dans tests/unit/contact.test.ts. Utilisée par le navigateur et par /api/contact.

import { adresseValide, type DemandeSeance } from "./email/modeles";

export const LIMITES_CONTACT = { prenom: 60, disponibilites: 200, message: 1500 } as const;

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

export type ChampsContact = { prenom: string; email: string; disponibilites: string; message: string; site: string };
export type ErreursContact = Partial<Record<"prenom" | "email" | "disponibilites" | "message", string>>;

export type VerdictContact =
  | { statut: "valide"; demande: DemandeSeance }
  | { statut: "invalide"; erreurs: ErreursContact }
  | { statut: "robot" };

const longueur = (texte: string) => [...texte].length; // un emoji compte pour un caractère
const nombre = new Intl.NumberFormat("fr-FR");

export function validerDemande(champs: ChampsContact): VerdictContact {
  if (champs.site.trim() !== "") return { statut: "robot" };

  const prenom = champs.prenom.trim();
  const email = champs.email.trim();
  const disponibilites = champs.disponibilites.trim();
  const message = champs.message.trim();
  const erreurs: ErreursContact = {};

  if (prenom === "") erreurs.prenom = "Indiquez votre prénom.";
  else if (longueur(prenom) > LIMITES_CONTACT.prenom) erreurs.prenom = `Le prénom dépasse ${LIMITES_CONTACT.prenom} caractères.`;

  if (!adresseValide(email)) erreurs.email = "Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.";

  if (longueur(disponibilites) > LIMITES_CONTACT.disponibilites) {
    erreurs.disponibilites = `Les disponibilités dépassent ${LIMITES_CONTACT.disponibilites} caractères.`;
  }

  if (message === "") erreurs.message = "Écrivez quelques mots sur votre demande.";
  else if (longueur(message) > LIMITES_CONTACT.message) {
    const enTrop = longueur(message) - LIMITES_CONTACT.message;
    erreurs.message = `Le message dépasse ${nombre.format(LIMITES_CONTACT.message)} caractères (${nombre.format(enTrop)} en trop).`;
  }

  if (Object.keys(erreurs).length > 0) return { statut: "invalide", erreurs };
  return { statut: "valide", demande: { prenom, email, disponibilites: disponibilites || undefined, message } };
}
