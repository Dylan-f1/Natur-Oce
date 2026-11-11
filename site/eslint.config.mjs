import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sorties de build Cloudflare (OpenNext, wrangler) et rapports de tests : pas notre code.
    ".open-next/**",
    ".wrangler/**",
    "test-results/**",
    "playwright-report/**",
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;
