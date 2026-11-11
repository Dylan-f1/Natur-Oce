import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // D-21 : les pages publiques sont servies en fichiers statiques. Un lien Next y demanderait
    // `?_rsc=`, recevrait du HTML puis rechargerait la page (3 requêtes au lieu d'une) : le site
    // public utilise donc de simples <a>. L'administration garde next/link.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
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
