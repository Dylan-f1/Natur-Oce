import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
