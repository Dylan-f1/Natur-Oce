# Natur-Océ · site

Application Next.js du site, déployée sur Cloudflare Workers. Installation, commandes et tests :
voir le [README du dépôt](../README.md).

- `app/` : pages publiques, administration (`app/admin/`), routes d’API (`app/api/`)
- `lib/` : base (Drizzle/D1), connexion (Better Auth), e-mails, limites, formats
- `drizzle/` : migrations SQL de D1
- `tests/unit/` : Vitest · `tests/e2e/` : Playwright
