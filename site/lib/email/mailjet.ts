// Envoi d'e-mails aux visiteurs par Mailjet (specs/SPEC-emails-client.md, EF-05, D-25).
// L'offre gratuite de Cloudflare n'écrit qu'à Océane ; Mailjet écrit au visiteur. Clés en secrets
// du Worker (MAILJET_API_KEY, MAILJET_API_SECRET), tapées par Dylan, jamais dans le dépôt.
// Partie pure (configuration, corps de l'appel) testée dans tests/unit/mailjet.test.ts.

export const API_MAILJET = "https://api.mailjet.com";
/** Seule autre adresse acceptée : un faux Mailjet local, pour les tests (comme le faux GitHub). */
const FAUX_MAILJET_LOCAL = /^http:\/\/127\.0\.0\.1:\d{2,5}$/;

export const EXPEDITEUR_CLIENT = { email: "contact@natur-oce.fr", name: "Océane — Natur’Océ" } as const;

export type ConfigMailjet = { cle: string; secret: string; api: string };

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Configuration lue dans les variables du Worker ; null si les clés manquent (envoi désactivé,
 * sans erreur). Une adresse d'API autre que Mailjet ou le faux local est refusée.
 */
export function lireConfigMailjet(variables: Record<string, unknown>): ConfigMailjet | null {
  const cle = texte(variables.MAILJET_API_KEY);
  const secret = texte(variables.MAILJET_API_SECRET);
  if (!cle || !secret) return null;
  const api = texte(variables.MAILJET_API_URL) || API_MAILJET;
  if (api !== API_MAILJET && !FAUX_MAILJET_LOCAL.test(api)) {
    throw new Error("MAILJET_API_URL refusée : seule l'API Mailjet (ou un faux Mailjet local de test) est acceptée");
  }
  return { cle, secret, api };
}

export type MessageClient = {
  destinataire: { email: string; nom?: string };
  sujet: string;
  texte: string;
  html: string;
  /** Par défaut : Océane — Natur’Océ <contact@natur-oce.fr> (expéditeur validé chez Mailjet). */
  expediteur?: { email: string; name: string };
  /** Par défaut : contact@natur-oce.fr. Pour Océane : l'adresse du visiteur. */
  repondreA?: string;
  piecesJointes?: { filename: string; type: string; content: string }[];
};

/** Texte (UTF-8) → base64, pour les pièces jointes Mailjet. */
function base64Utf8(texte: string): string {
  let binaire = "";
  for (const o of new TextEncoder().encode(texte)) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

/** Corps de `POST /v3.1/send` : un message, réponse vers contact@, suivi des ouvertures et clics coupé. */
export function corpsMailjet(m: MessageClient) {
  return {
    Messages: [
      {
        From: { Email: (m.expediteur ?? EXPEDITEUR_CLIENT).email, Name: (m.expediteur ?? EXPEDITEUR_CLIENT).name },
        To: [{ Email: m.destinataire.email, ...(m.destinataire.nom ? { Name: m.destinataire.nom } : {}) }],
        ReplyTo: m.repondreA ? { Email: m.repondreA } : { Email: EXPEDITEUR_CLIENT.email, Name: EXPEDITEUR_CLIENT.name },
        Subject: m.sujet,
        TextPart: m.texte,
        HTMLPart: m.html,
        TrackOpens: "disabled",
        TrackClicks: "disabled",
        ...(m.piecesJointes?.length
          ? { Attachments: m.piecesJointes.map((a) => ({ ContentType: a.type, Filename: a.filename, Base64Content: base64Utf8(a.content) })) }
          : {}),
      },
    ],
  };
}

export type IssueMailjet = { ok: true } | { ok: false; raison: string };

/** Envoie un message par Mailjet. Ne lève jamais : l'échec est renvoyé (et journalisé par l'appelant). */
export async function envoyerParMailjet(config: ConfigMailjet, m: MessageClient, delaiMs = 8000): Promise<IssueMailjet> {
  try {
    const reponse = await fetch(`${config.api}/v3.1/send`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${config.cle}:${config.secret}`)}`,
        "Content-Type": "application/json",
        "User-Agent": "natur-oce-site",
      },
      body: JSON.stringify(corpsMailjet(m)),
      signal: AbortSignal.timeout(delaiMs),
    });
    if (!reponse.ok) return { ok: false, raison: `Mailjet a répondu ${reponse.status}` };
    const retour = (await reponse.json().catch(() => null)) as { Messages?: { Status?: string }[] } | null;
    const statut = retour?.Messages?.[0]?.Status;
    return statut === "success" ? { ok: true } : { ok: false, raison: `statut Mailjet : ${statut ?? "inconnu"}` };
  } catch (erreur) {
    return { ok: false, raison: erreur instanceof Error ? erreur.message : "appel impossible" };
  }
}
