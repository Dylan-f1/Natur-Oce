// Modèles et préparation des e-mails envoyés à Océane (specs/SPEC-envoi-email.md).
// Logique pure, sans binding : testée dans tests/unit/email.test.ts.
// Mise en forme « Bandeau olive » (choix de Dylan du 13/11, design/emails.html, direction 2) :
// tableaux et styles en ligne, Georgia, pour s'afficher pareil dans Outlook, Gmail et sur téléphone.

import { fichierAgenda } from "./agenda";

export type PieceJointe = { filename: string; type: string; content: string };

export type MessageOceane = {
  sujet: string;
  texte: string;
  html: string;
  /** Adresse du visiteur, pour qu'Océane réponde directement (demande de séance). */
  repondreA?: string;
  piecesJointes?: PieceJointe[];
};

export const EXPEDITEUR = { email: "site@natur-oce.fr", name: "Natur’Océ (site)" } as const;

/** Logo en PNG (le WebP ne s'affiche pas dans Outlook), servi par le site. */
export const LOGO_EMAIL = "https://natur-oce.fr/logo-email.png";

const ENTITES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Échappe un texte avant de l'insérer dans du HTML d'e-mail. */
export function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ENTITES[c]);
}

/** Sujet sûr : sans retour à la ligne (pas d'injection d'en-têtes), espaces resserrés, 100 car. max. */
export function nettoyerSujet(sujet: string): string {
  const net = sujet.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return net.length > 100 ? `${net.slice(0, 99)}…` : net;
}

/** Adresse plausible pour `Reply-To` : une seule adresse, sans espace ni retour à la ligne. */
export function adresseValide(adresse: string): boolean {
  return /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(adresse) && adresse.length <= 254;
}

/** Message prêt pour le binding `send_email` (EmailMessageBuilder). */
export function preparerEnvoi(message: MessageOceane, adminEmail: string) {
  return {
    from: { ...EXPEDITEUR },
    to: adminEmail,
    subject: nettoyerSujet(message.sujet),
    text: message.texte,
    html: message.html,
    ...(message.repondreA && adresseValide(message.repondreA) ? { replyTo: message.repondreA } : {}),
    ...(message.piecesJointes?.length
      ? { attachments: message.piecesJointes.map((p) => ({ ...p, disposition: "attachment" as const })) }
      : {}),
  };
}

const PIED = "Ce message a été envoyé automatiquement par le site natur-oce.fr.";
const C = { fond: "#EFEBE2", olive: "#3D491B", papier: "#FBF5F0", feuille: "#F3EBDD", encre: "#343A20", gris: "#5C6448", discret: "#6A6248" };

/** Bouton : plein (action principale) ou au trait. `href` doit déjà être une URL sûre. */
function bouton(libelle: string, href: string, plein = true): string {
  const fond = plein ? C.olive : "#ffffff";
  const texte = plein ? "#ffffff" : C.olive;
  return `<a href="${echapperHtml(href)}" style="display:inline-block;background:${fond};color:${texte};border:1px solid ${C.olive};padding:12px 20px;font-family:Georgia,serif;font-size:16px;text-decoration:none;border-radius:2px;margin:0 8px 8px 0">${echapperHtml(libelle)}</a>`;
}

/** Tableau d'informations sur fond crème (intitulé à gauche, valeur à droite). Valeurs déjà échappées. */
function infos(lignes: [string, string][]): string {
  const rangs = lignes
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:${C.discret};vertical-align:top;width:34%">${echapperHtml(k)}</td><td style="padding:6px 0;font-size:16px;color:${C.encre};word-break:break-word">${v}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 20px;background:${C.feuille}"><tr><td style="padding:12px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rangs}</table></td></tr></table>`;
}

function gabarit(titre: string, corpsHtml: string, pied: string = PIED): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.fond};font-family:Georgia,serif;color:${C.encre}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.fond}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;border-collapse:collapse">
<tr><td style="background:${C.olive};padding:20px 24px"><img src="${LOGO_EMAIL}" width="48" height="48" alt="Natur’Océ" style="border-radius:50%;vertical-align:middle;border:0"> <span style="color:${C.papier};font-size:20px;vertical-align:middle;margin-left:10px">Natur’Océ</span></td></tr>
<tr><td style="background:#ffffff;padding:28px 24px;font-size:16px;line-height:1.6">
<h1 style="margin:0 0 16px;font-weight:normal;font-size:26px;line-height:1.2;color:${C.olive}">${echapperHtml(titre)}</h1>
${corpsHtml}
</td></tr>
<tr><td style="background:${C.feuille};padding:14px 24px;font-size:12px;color:${C.discret}">${pied}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Lien de connexion à l'administration (module `connexion`). */
export function modeleLienConnexion(url: string): MessageOceane {
  return {
    sujet: "Votre lien de connexion à Natur’Océ",
    texte: [
      "Bonjour Océane,",
      "",
      "Voici votre lien de connexion à l’administration du site. Il est valable 10 minutes et ne sert qu’une fois :",
      url,
      "",
      "Si vous n’avez rien demandé, ignorez ce message.",
      "",
      PIED,
    ].join("\n"),
    html: gabarit(
      "Votre lien de connexion",
      `<p style="margin:0 0 16px">Bonjour Océane,</p>
<p style="margin:0 0 20px">Voici votre lien de connexion à l’administration du site. Il est valable 10 minutes et ne sert qu’une fois.</p>
<p style="margin:0 0 12px">${bouton("Me connecter", url)}</p>
<p style="margin:0;font-size:14px;color:${C.gris}">Si vous n’avez rien demandé, ignorez ce message.</p>`,
    ),
  };
}

export type DemandeSeance = {
  prenom: string;
  email: string;
  /** Créneau en toutes lettres (« mercredi 18 novembre 2026 à 18 h 30 »), s'il a été choisi. */
  disponibilites?: string;
  /** Le même créneau, en valeurs de champs (« 2026-11-18 », « 18:30 ») : sert au fichier d'agenda. */
  creneau?: { jour: string; heure: string };
  message: string;
};

/** Lien `mailto:` qui ouvre une réponse déjà écrite dans la messagerie d'Océane. */
export function lienReponse(adresse: string, sujet: string, corps: string): string {
  const pour = adresse.replace(/[?&#%]/g, (c) => encodeURIComponent(c));
  return `mailto:${pour}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps.replace(/\n/g, "\r\n"))}`;
}

/** Réponses proposées à Océane : à relire et compléter (lien de visio) avant d'envoyer. */
export function reponsesProposees(d: DemandeSeance): { confirmer?: { sujet: string; corps: string }; autre: { sujet: string; corps: string } } {
  const signature = "\n\nÀ bientôt,\nOcéane\nNatur’Océ — naturopathie en visio";
  const autre = {
    sujet: "Votre demande de séance",
    corps: `Bonjour ${d.prenom},\n\nMerci pour votre message. ${d.disponibilites ? "Ce créneau ne m’est malheureusement pas possible ; je" : "Je"} vous propose plutôt : [jour et heure].\n\nDites-moi si cela vous convient.${signature}`,
  };
  if (!d.disponibilites) return { autre };
  return {
    confirmer: {
      sujet: `Votre séance du ${d.disponibilites}`,
      corps: `Bonjour ${d.prenom},\n\nC’est noté : je vous retrouve en visio le ${d.disponibilites}.\nVoici le lien de la séance : [lien de visio]\n\nPrévoyez un endroit calme et une connexion stable. En cas d’empêchement, prévenez-moi au moins 24 heures avant.${signature}`,
    },
    autre,
  };
}

/** Notification d'une demande de séance (module `contact`). */
export function modeleDemandeSeance(d: DemandeSeance): MessageOceane {
  const dispo = d.disponibilites?.trim() || "non précisées";
  const valide = adresseValide(d.email);
  const reponses = reponsesProposees(d);
  const boutons = valide
    ? [
        reponses.confirmer && bouton("Confirmer ce créneau", lienReponse(d.email, reponses.confirmer.sujet, reponses.confirmer.corps)),
        bouton(reponses.confirmer ? "Proposer un autre créneau" : "Proposer un créneau", lienReponse(d.email, reponses.autre.sujet, reponses.autre.corps), !reponses.confirmer),
      ].filter(Boolean).join("")
    : "";
  const agenda = d.creneau
    ? fichierAgenda({
        jour: d.creneau.jour,
        heure: d.creneau.heure,
        dureeMinutes: 60,
        titre: `Séance avec ${d.prenom} (à confirmer)`,
        description: `Demande de séance de ${d.prenom} (${d.email}).\n\n${d.message}`,
        uid: `${d.creneau.jour}-${d.creneau.heure.replace(":", "")}-${d.email.replace(/[^a-z0-9]/gi, "")}`.slice(0, 120),
      })
    : null;

  return {
    sujet: `Nouvelle demande de séance — ${d.prenom}`,
    repondreA: d.email,
    texte: [
      `Nouvelle demande de séance de ${d.prenom} (${d.email}).`,
      "",
      `Disponibilités : ${dispo}`,
      "",
      "Message :",
      d.message,
      "",
      "Répondez directement à ce message pour lui écrire.",
      ...(agenda ? ["", "Le créneau est joint en fichier d’agenda (seance.ics)."] : []),
      "",
      PIED,
    ].join("\n"),
    html: gabarit(
      `Nouvelle demande de séance — ${d.prenom}`,
      `<p style="margin:0 0 12px">${echapperHtml(d.prenom)} souhaite une séance. ${boutons ? "Répondez en un clic : votre réponse s’ouvre déjà écrite, à relire et compléter avant d’envoyer." : ""}</p>
${infos([
  ["De", `${echapperHtml(d.prenom)} · ${echapperHtml(d.email)}`],
  ["Disponibilités", echapperHtml(dispo)],
  ["Message", `<span style="white-space:pre-wrap">${echapperHtml(d.message)}</span>`],
])}
${boutons ? `<div style="margin:0 0 8px">${boutons}</div>` : ""}
<p style="margin:8px 0 0;font-size:14px;color:${C.gris}">Vous pouvez aussi répondre directement à ce message.${agenda ? " Le créneau est joint en fichier d’agenda : ouvrez-le pour l’ajouter à votre calendrier." : ""}</p>`,
    ),
    ...(agenda ? { piecesJointes: [{ filename: "seance.ics", type: "text/calendar", content: agenda }] } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// E-mails au visiteur (specs/SPEC-emails-client.md, EF-05) : envoyés par Mailjet (lib/email/mailjet.ts).
// N'importe qui peut taper n'importe quelle adresse : aucun texte libre du visiteur n'y est recopié,
// sauf un prénom fait seulement de lettres (sinon « Bonjour, »). Le site ne sert pas de relais.

const PIED_CLIENT = "Natur’Océ — naturopathie en visio · natur-oce.fr";
const AVERT_CLIENT = "La naturopathie ne remplace pas un avis médical : continuez vos traitements et consultez votre médecin.";

/** Prénom repris dans l'e-mail seulement s'il n'est fait que de lettres, espaces, apostrophes, traits d'union. */
export function prenomSur(prenom: string): string | null {
  const p = prenom.trim();
  return /^[\p{L}][\p{L}\p{M}' ’-]{0,39}$/u.test(p) && !/\s{2,}/.test(p) ? p : null;
}

/** Accusé de réception d'une demande de séance (T20). */
export function modeleAccuseReception(d: Pick<DemandeSeance, "prenom" | "disponibilites">): { sujet: string; texte: string; html: string; nom?: string } {
  const prenom = prenomSur(d.prenom);
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const creneau = d.disponibilites?.trim() || null;
  return {
    sujet: "Votre demande de séance est bien reçue",
    nom: prenom ?? undefined,
    texte: [
      bonjour,
      "",
      "Merci pour votre message. Votre demande de séance en visio est bien reçue : Océane vous répond sous 48 heures pour confirmer le rendez-vous.",
      ...(creneau ? ["", `Créneau demandé : ${creneau}`] : []),
      "",
      "Pour ajouter quelque chose, répondez simplement à ce message.",
      "",
      "À bientôt,",
      "Océane",
      "",
      AVERT_CLIENT,
      "",
      PIED_CLIENT,
    ].join("\n"),
    html: gabarit(
      "Votre demande est bien reçue",
      `<p style="margin:0 0 12px">${echapperHtml(bonjour)}</p>
<p style="margin:0 0 12px">Merci pour votre message. Votre demande de séance en visio est bien reçue : je vous réponds sous 48 heures pour confirmer le rendez-vous.</p>
${creneau ? infos([["Créneau demandé", echapperHtml(creneau)]]) : ""}
<p style="margin:0 0 12px;font-size:14px;color:${C.gris}">Pour ajouter quelque chose, répondez simplement à ce message.</p>
<p style="margin:20px 0 0">À bientôt,<br><strong>Océane</strong></p>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${C.discret};font-style:italic">${AVERT_CLIENT}</p>`,
      PIED_CLIENT,
    ),
  };
}
