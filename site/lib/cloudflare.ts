import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Bindings Cloudflare de la requête en cours (D1, R2, e-mail, variables).
 * À appeler dans le code serveur, à chaque requête : jamais stocké dans une variable globale
 * (contrainte OpenNext : le contexte change d'une requête à l'autre).
 */
export async function env(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env;
}
