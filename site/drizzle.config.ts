import { defineConfig } from "drizzle-kit";

// Génère les migrations SQL de D1 dans drizzle/ (appliquées par `wrangler d1 migrations apply`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
