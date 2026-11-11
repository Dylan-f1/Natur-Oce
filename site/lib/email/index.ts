import { env } from "@/lib/cloudflare";
import { preparerEnvoi, type MessageOceane } from "./modeles";

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

/**
 * Envoie un message à Océane, et à elle seule : l'adresse vient du secret ADMIN_EMAIL
 * (vérifiée dans Cloudflare Email Routing en production).
 */
export async function envoyerAOceane(message: MessageOceane) {
  const { EMAIL, ADMIN_EMAIL } = await env();
  if (!ADMIN_EMAIL) throw new EchecEnvoi(new Error("ADMIN_EMAIL manquant"));
  return envoyerAvec(EMAIL, ADMIN_EMAIL, message);
}
