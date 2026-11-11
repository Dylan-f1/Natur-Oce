// Modèles et préparation des e-mails envoyés à Océane (specs/SPEC-envoi-email.md).
// Logique pure, sans binding : testée dans tests/unit/email.test.ts.

export type MessageOceane = {
  sujet: string;
  texte: string;
  html: string;
  /** Adresse du visiteur, pour qu'Océane réponde directement (demande de séance). */
  repondreA?: string;
};

export const EXPEDITEUR = { email: "site@natur-oce.fr", name: "Natur’Océ (site)" } as const;

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
  };
}

const PIED = "Ce message a été envoyé automatiquement par le site natur-oce.fr.";

function gabarit(titre: string, corpsHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#FBF5F0;color:#343A20;font-family:Georgia,serif;font-size:16px;line-height:1.6">
<div style="max-width:560px;margin:0 auto;background:#FFFDF8;border:1px solid #DCCFB4;padding:24px">
<h1 style="margin:0 0 16px;font-size:22px;color:#3D491B">${echapperHtml(titre)}</h1>
${corpsHtml}
<p style="margin:24px 0 0;font-size:13px;color:#6B5A3A">${PIED}</p>
</div></body></html>`;
}

/** Lien de connexion à l'administration (module `connexion`). */
export function modeleLienConnexion(url: string): MessageOceane {
  const lien = echapperHtml(url);
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
<p style="margin:0 0 16px">Voici votre lien de connexion à l’administration du site. Il est valable 10 minutes et ne sert qu’une fois.</p>
<p style="margin:0 0 16px"><a href="${lien}" style="display:inline-block;background:#3D491B;color:#FBF5F0;padding:12px 20px;text-decoration:none">Me connecter</a></p>
<p style="margin:0 0 16px">Si vous n’avez rien demandé, ignorez ce message.</p>`,
    ),
  };
}

export type DemandeSeance = {
  prenom: string;
  email: string;
  disponibilites?: string;
  message: string;
};

/** Notification d'une demande de séance (module `contact`). */
export function modeleDemandeSeance(d: DemandeSeance): MessageOceane {
  const dispo = d.disponibilites?.trim() || "non précisées";
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
      "",
      PIED,
    ].join("\n"),
    html: gabarit(
      `Nouvelle demande de séance — ${d.prenom}`,
      `<p style="margin:0 0 8px"><strong>De :</strong> ${echapperHtml(d.prenom)} (${echapperHtml(d.email)})</p>
<p style="margin:0 0 16px"><strong>Disponibilités :</strong> ${echapperHtml(dispo)}</p>
<p style="margin:0 0 8px"><strong>Message :</strong></p>
<p style="margin:0 0 16px;white-space:pre-wrap">${echapperHtml(d.message)}</p>
<p style="margin:0">Répondez directement à ce message pour lui écrire.</p>`,
    ),
  };
}
