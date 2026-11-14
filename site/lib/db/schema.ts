import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Schéma D1 de Natur'Océ (specs/SPEC-base-donnees.md). Dates en millisecondes.
// Les longueurs maximales sont contrôlées côté application (lib/*/validation).

/** Tarifs des séances, affichés sur l'accueil (EF-03) et modifiables par Océane (EF-12). */
export const tarif = sqliteTable("tarif", {
  id: text("id").primaryKey(),
  libelle: text("libelle").notNull(), // ≤ 80 caractères
  dureeMinutes: integer("duree_minutes"), // facultatif
  prixCentimes: integer("prix_centimes").notNull(), // 0 à 99 900
  ordre: integer("ordre").notNull().default(0),
});

export type Tarif = typeof tarif.$inferSelect;

/**
 * Réglages d'Océane, jamais publics (T21, specs/SPEC-emails-client.md) : `lien_visio` (son lien de
 * visio permanent) et `duree_minutes` (durée d'une séance). Validation dans lib/reglages.ts.
 */
export const reglage = sqliteTable("reglage", {
  cle: text("cle").primaryKey(),
  valeur: text("valeur").notNull(),
  modifieLe: integer("modifie_le").notNull(),
});

/**
 * Sections ajoutées par Océane à l'accueil (specs/SPEC-edition-visuelle.md, EF-21, D-24).
 * `apres` = clé de la section d'origine qu'elle suit ; `ordre` = rang parmi celles qui la suivent.
 * Texte brut seulement (limites dans lib/sections.ts).
 */
export const section = sqliteTable("section", {
  id: text("id").primaryKey(),
  modele: text("modele", { enum: ["texte", "texte_liste", "texte_photo"] }).notNull(),
  titre: text("titre").notNull(),
  texte: text("texte").notNull().default(""),
  liste: text("liste").notNull().default(""),
  bouton: integer("bouton", { mode: "boolean" }).notNull().default(false),
  imageCle: text("image_cle"),
  imageAlt: text("image_alt"),
  apres: text("apres").notNull(),
  ordre: integer("ordre").notNull().default(0),
  modifieLe: integer("modifie_le").notNull(),
});

export type Section = typeof section.$inferSelect;

/**
 * Textes de l'accueil modifiables par Océane (specs/SPEC-textes.md, EF-19, D-23). `cle` parmi
 * celles de lib/textes.ts ; une clé absente prend sa valeur de départ. Texte brut, jamais du HTML.
 */
export const texte = sqliteTable("texte", {
  cle: text("cle").primaryKey(),
  valeur: text("valeur").notNull(), // limites dans lib/textes.ts
  modifieLe: integer("modifie_le").notNull(),
});

/** Catégories d'articles, créées librement par Océane (30 caractères max). */
export const categorie = sqliteTable("categorie", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  slug: text("slug").notNull().unique(),
  creeLe: integer("cree_le").notNull(),
});

export type Categorie = typeof categorie.$inferSelect;

/**
 * Articles du blog (specs/SPEC-articles.md). `contenu_json` = document de l'éditeur (source),
 * `contenu_html` = HTML public produit côté serveur par lib/articles/rendu.ts à chaque
 * enregistrement. `slug` figé à la 1re publication (EF-07).
 */
export const article = sqliteTable(
  "article",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    titre: text("titre").notNull(), // ≤ 90
    resume: text("resume").notNull().default(""), // ≤ 160
    categorieId: text("categorie_id").references(() => categorie.id, { onDelete: "set null" }),
    contenuJson: text("contenu_json").notNull(),
    contenuHtml: text("contenu_html").notNull(),
    statut: text("statut", { enum: ["brouillon", "publie"] }).notNull().default("brouillon"),
    publieLe: integer("publie_le"), // ms, renseigné à la 1re publication
    creeLe: integer("cree_le").notNull(),
    modifieLe: integer("modifie_le").notNull(),
  },
  (t) => [index("article_statut_publie_idx").on(t.statut, t.publieLe)],
);

export type Article = typeof article.$inferSelect;

/**
 * Compteurs de limite du site (demandes de lien, formulaire de contact). `cle` = HMAC-SHA-256
 * (clé secrète du site) de l'usage et de l'IP : impossible de retrouver l'IP sans la clé (RGPD).
 */
export const limite = sqliteTable("limite", {
  cle: text("cle").primaryKey(),
  compteur: integer("compteur").notNull(),
  finFenetre: integer("fin_fenetre").notNull(), // ms
});

// ---------------------------------------------------------------------------------------------
// Tables de Better Auth (module `connexion`, specs/SPEC-connexion.md). Les noms de propriétés
// sont ceux qu'attend Better Auth 1.7 (core/dist/db/get-tables.mjs) ; colonnes SQL en snake_case.

const horodatage = (nom: string) => integer(nom, { mode: "timestamp_ms" });

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: horodatage("created_at").notNull(),
  updatedAt: horodatage("updated_at").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: horodatage("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: horodatage("created_at").notNull(),
    updatedAt: horodatage("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: horodatage("access_token_expires_at"),
    refreshTokenExpiresAt: horodatage("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"), // jamais utilisé : connexion par lien e-mail seul (D-18)
    createdAt: horodatage("created_at").notNull(),
    updatedAt: horodatage("updated_at").notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(), // jeton du lien, stocké haché
    value: text("value").notNull(),
    expiresAt: horodatage("expires_at").notNull(),
    createdAt: horodatage("created_at").notNull(),
    updatedAt: horodatage("updated_at").notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Compteurs de limite de Better Auth (T5 : 3 demandes de lien par 15 min). */
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

/**
 * Images des articles (specs/SPEC-images.md, D-22) : rangées ici plutôt que dans R2, figées en
 * fichiers statiques à chaque publication (D-21). `cle` = `<uuid>.webp` ou `<uuid>.jpg`.
 * La description (alt) reste dans l'article : une même image peut servir deux fois.
 */
export const image = sqliteTable("image", {
  cle: text("cle").primaryKey(),
  type: text("type", { enum: ["image/webp", "image/jpeg"] }).notNull(),
  donnees: blob("donnees", { mode: "buffer" }).notNull(), // ≤ 1,5 Mo (lib/images.ts)
  largeur: integer("largeur").notNull(),
  hauteur: integer("hauteur").notNull(),
  taille: integer("taille").notNull(),
  creeLe: integer("cree_le").notNull(),
});
