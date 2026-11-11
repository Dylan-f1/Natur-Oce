// Règles pures de la connexion (specs/SPEC-connexion.md), testées dans tests/unit/connexion.test.ts.

/** « Oceane@Exemple.test » et « oceane@exemple.test » désignent la même adresse. */
export function normaliserAdresse(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/** Seule l'adresse d'Océane (secret ADMIN_EMAIL) peut recevoir un lien et ouvrir une session. */
export function estAutorisee(adresse: string, adminEmail: string | undefined): boolean {
  if (!adminEmail) return false;
  return normaliserAdresse(adresse) === normaliserAdresse(adminEmail);
}

const ORIGINE_PROD = "https://natur-oce.fr";
/** Poste local (`wrangler dev`, tests) : toujours en http. */
const HOTE_LOCAL = /^(127\.0\.0\.1|localhost):\d{2,5}$/;
// Mise en ligne de test sur l'adresse gratuite de Cloudflare (natur-oce.<sous-domaine>.workers.dev).
// Cloudflare n'achemine vers notre Worker que les requêtes dont l'Host est le sien : un Host forgé
// vers un autre sous-domaine n'arrive jamais jusqu'ici.
const ORIGINE_TEST = /^https:\/\/natur-oce\.[a-z0-9-]+\.workers\.dev$/;

/**
 * Origine du site pour cette requête, choisie dans une liste fermée : la production, l'adresse
 * de test, ou le poste local. Toute autre valeur d'en-tête Host retombe sur la production,
 * pour qu'un en-tête forgé ne puisse pas fabriquer des liens de connexion vers un autre domaine.
 */
export function origineDeConfiance(host: string | null, proto: string | null): string {
  if (!host) return ORIGINE_PROD;
  if (HOTE_LOCAL.test(host)) return `http://${host}`;
  const origine = `${proto ?? "https"}://${host}`;
  if (origine === ORIGINE_PROD || ORIGINE_TEST.test(origine)) return origine;
  return ORIGINE_PROD;
}
