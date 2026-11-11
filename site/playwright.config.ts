import { defineConfig } from "@playwright/test";

// Tests de bout en bout contre le build Cloudflare servi par `wrangler dev` (workerd),
// avec le Chrome installé sur le poste : aucun navigateur téléchargé.
// Port 8791 pour ne pas gêner l'aperçu manuel (`natur-oce-site`, port 8790).
const PORT = 8791;

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
  webServer: {
    // Migrations D1 locales d'abord (idempotent), puis build Cloudflare, puis workerd.
    command: `npx wrangler d1 migrations apply natur-oce --local && npx opennextjs-cloudflare build && npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    timeout: 300_000, // build Next + OpenNext + démarrage de workerd
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
