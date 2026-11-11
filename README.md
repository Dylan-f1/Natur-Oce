# Natur-Océ

Site vitrine et blog d’une naturopathe en visio, avec une administration pour publier ses conseils
et modifier ses tarifs. Le code est dans [`site/`](site/).

## Stack

- **Next.js 16** (App Router, TypeScript), sur **Cloudflare Workers** via `@opennextjs/cloudflare`
- **Cloudflare D1** + **Drizzle** (base de données), migrations dans `site/drizzle/`
- **Better Auth** : connexion à l’administration par lien e-mail, sans mot de passe
- **Cloudflare Email Routing** : e-mails du site (binding `send_email`)
- Tests : **Vitest** (unitaires) et **Playwright** (bout en bout, contre `wrangler dev`)

## Lancer en local

```bash
cd site
npm install
cp .dev.vars.example .dev.vars        # puis générer BETTER_AUTH_SECRET (voir le fichier)
npx wrangler d1 migrations apply natur-oce --local
npm run dev                           # développement
npx opennextjs-cloudflare build && npx wrangler dev --port 8790   # tel que sur Cloudflare
```

## Tests

```bash
cd site
npm test           # unitaires
npm run test:e2e   # bout en bout (build Cloudflare + wrangler dev, Chrome du poste)
npm run lint
```

## Branches

- `main` : version livrée
- `dev` : cible des pull requests de fonctionnalité

Messages de commit en français : `[ADD|UPDATE|FIX|DELETE] ID sujet`, où `ID` renvoie à
l’exigence traitée (`EF-…`, `ENF-…`, `RSE-…`).
