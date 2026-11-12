import { defineConfig } from "@playwright/test";

// Tests de bout en bout contre le build Cloudflare servi par `wrangler dev` (workerd),
// avec le Chrome installé sur le poste : aucun navigateur téléchargé.
// Port 8791 pour ne pas gêner l'aperçu manuel (`natur-oce-site`, port 8790).
const PORT = 8791;
const FAUX_GITHUB = "http://127.0.0.1:8796";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // un seul serveur wrangler partagé, base D1 locale commune
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // Faux GitHub (P3) : reçoit les demandes de publication à la place du vrai.
      command: `node tests/e2e/outils/faux-github.mjs`,
      url: `${FAUX_GITHUB}/_faux/sante`,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // Migrations D1 locales d'abord (idempotent), puis build Cloudflare, puis workerd. Le jeton
      // est fictif et l'API pointe sur le faux GitHub : aucun appel au vrai.
      command:
        `npx wrangler d1 migrations apply natur-oce --local && npx opennextjs-cloudflare build && ` +
        // Origine locale gardée : sinon wrangler présente les requêtes comme venant de natur-oce.fr
        // (première route de wrangler.jsonc), et les liens de connexion pointeraient vers le site en ligne.
        `npx wrangler dev --port ${PORT} --ip 127.0.0.1 --infer-origin-from-routes=false ` +
        `--var GITHUB_PUBLICATION_TOKEN:jeton-de-test --var GITHUB_API_URL:${FAUX_GITHUB}`,
      url: `http://127.0.0.1:${PORT}/`,
      timeout: 300_000, // build Next + OpenNext + démarrage de workerd
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
