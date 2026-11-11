import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { drizzle } from "drizzle-orm/d1";
import { env } from "@/lib/cloudflare";
import * as schema from "@/lib/db/schema";
import { envoyerAOceane, modeleLienConnexion } from "@/lib/email";
import { estAutorisee, origineDeConfiance } from "./regles";

export { estAutorisee, normaliserAdresse, origineDeConfiance } from "./regles";

const TRENTE_JOURS = 60 * 60 * 24 * 30;
const DIX_MINUTES = 60 * 10;

/**
 * Instance Better Auth pour la requête en cours (contrainte OpenNext : bindings par requête).
 * Connexion par lien e-mail seul, réservée à Océane (D-18) ; pas de mot de passe.
 */
export async function creerAuth(origine: string) {
  const { DB, ADMIN_EMAIL, BETTER_AUTH_SECRET } = await env();

  return betterAuth({
    appName: "Natur’Océ",
    baseURL: origine,
    basePath: "/api/auth",
    secret: BETTER_AUTH_SECRET,
    trustedOrigins: [origine],
    database: drizzleAdapter(drizzle(DB, { schema }), {
      provider: "sqlite",
      schema,
      transaction: false, // D1 n'a pas de transactions interactives
    }),
    emailAndPassword: { enabled: false },
    // Limites de Better Auth pour les appels HTTP directs à /api/auth/* (l'action de la page de
    // connexion a son propre compteur, lib/limite.ts). Stockées en D1 : la mémoire d'un Worker
    // n'est pas partagée entre ses instances.
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: { "/sign-in/magic-link": { window: 15 * 60, max: 3 } },
    },
    session: { expiresIn: TRENTE_JOURS, updateAge: 60 * 60 * 24 },
    telemetry: { enabled: false }, // déjà le défaut : rien ne part vers un service tiers (RSE-03)
    advanced: {
      cookiePrefix: "natur-oce",
      useSecureCookies: origine.startsWith("https://"),
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] }, // IP réelle derrière Cloudflare
    },
    databaseHooks: {
      user: {
        create: {
          // Seconde barrière : aucun compte ne peut être créé pour une autre adresse.
          before: async (nouveau) => (estAutorisee(nouveau.email, ADMIN_EMAIL) ? undefined : false),
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: DIX_MINUTES,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          // Autre adresse : on ne fait rien, et la page affiche le même message (pas d'énumération).
          if (!estAutorisee(email, ADMIN_EMAIL)) return;
          try {
            await envoyerAOceane(modeleLienConnexion(url));
          } catch (erreur) {
            // On n'expose pas l'échec à l'écran : il trahirait que l'adresse est la bonne.
            // Repli R-15 : lien de secours en ligne de commande (T13).
            console.error("[connexion] lien non envoyé", erreur);
          }
        },
      }),
      nextCookies(), // doit rester le dernier plugin
    ],
  });
}

/** Origine de confiance à partir des en-têtes de la requête (Server Actions, pages). */
export function origineDesEntetes(entetes: Headers): string {
  return origineDeConfiance(entetes.get("host"), entetes.get("x-forwarded-proto"));
}
