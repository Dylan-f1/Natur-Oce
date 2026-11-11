import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires : logique pure (validation, rendu, formats). Les parcours sont en E2E (Playwright).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
