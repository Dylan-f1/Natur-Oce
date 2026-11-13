import { env } from "@/lib/cloudflare";
import { envoyerParMailjet, lireConfigMailjet, type ConfigMailjet, type IssueMailjet, type MessageClient } from "./mailjet";
import { adresseValide, nettoyerSujet, preparerEnvoi, type MessageOceane } from "./modeles";

export * from "./modeles";

/** Erreur d'envoi, avec un message que l'interface peut montrer tel quel. */
export class EchecEnvoi extends Error {
  constructor(cause: unknown) {
    super("L’envoi de l’e-mail a échoué.", { cause });
    this.name = "EchecEnvoi";
  }
}

/** Envoie un message à Océane avec un binding donné (testable avec les bindings simulés). */
export async function envoyerAvec(binding: SendEmail, adminEmail: string, message: MessageOceane) {
  try {
    return await binding.send(preparerEnvoi(message, adminEmail));
  } catch (erreur) {
    console.error("[email] envoi impossible", erreur);
    throw new EchecEnvoi(erreur);
  }
}

/** Expéditeur des e-mails à Océane quand ils passent par Mailjet (adresse validée chez Mailjet). */
const EXPEDITEUR_SITE_MAILJET = { email: "contact@natur-oce.fr", name: "Natur’Océ (site)" } as const;

/** Le message d'Océane, mis au format de l'envoi Mailjet. */
export function versMailjet(message: MessageOceane, adminEmail: string): MessageClient {
  return {
    destinataire: { email: adminEmail },
    expediteur: { ...EXPEDITEUR_SITE_MAILJET },
    sujet: nettoyerSujet(message.sujet),
    texte: message.texte,
    html: message.html,
    ...(message.repondreA && adresseValide(message.repondreA) ? { repondreA: message.repondreA } : {}),
    ...(message.piecesJointes?.length ? { piecesJointes: message.piecesJointes } : {}),
  };
}

/**
 * Choix du chemin (13/11) : Outlook écarte en silence les e-mails que le site envoie par Cloudflare,
 * alors que ceux de Mailjet arrivent. Mailjet d'abord quand il est configuré, Cloudflare en secours.
 * Lève EchecEnvoi seulement si les deux échouent.
 */
export async function envoyerAOceaneAvec(o: {
  message: MessageOceane;
  adminEmail: string;
  mailjet: ConfigMailjet | null;
  binding: SendEmail;
  envoyerMailjet?: (c: ConfigMailjet, m: MessageClient) => Promise<IssueMailjet>;
}): Promise<"mailjet" | "cloudflare"> {
  if (o.mailjet) {
    const issue = await (o.envoyerMailjet ?? envoyerParMailjet)(o.mailjet, versMailjet(o.message, o.adminEmail));
    if (issue.ok) return "mailjet";
    console.error("[email] Mailjet impossible, envoi par Cloudflare en secours :", issue.raison);
  }
  await envoyerAvec(o.binding, o.adminEmail, o.message);
  return "cloudflare";
}

/**
 * Envoie un message à Océane, et à elle seule : l'adresse vient du secret ADMIN_EMAIL.
 * `EMAILS_OCEANE=cloudflare` force l'envoi par Cloudflare (tests de bout en bout locaux).
 */
export async function envoyerAOceane(message: MessageOceane) {
  const variables = await env();
  const { EMAIL, ADMIN_EMAIL } = variables;
  if (!ADMIN_EMAIL) throw new EchecEnvoi(new Error("ADMIN_EMAIL manquant"));
  const brut = variables as unknown as Record<string, unknown>;
  let mailjet: ConfigMailjet | null = null;
  if (brut.EMAILS_OCEANE !== "cloudflare") {
    try {
      mailjet = lireConfigMailjet(brut);
    } catch (erreur) {
      console.error("[email] configuration Mailjet refusée", erreur);
    }
  }
  return envoyerAOceaneAvec({ message, adminEmail: ADMIN_EMAIL, mailjet, binding: EMAIL });
}
