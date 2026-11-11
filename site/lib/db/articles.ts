import { and, asc, desc, eq, sql } from "drizzle-orm";
import { creerSlug, slugPourEnregistrement } from "@/lib/articles/slug";
import { db } from "./index";
import { article, categorie, type Categorie } from "./schema";

// Accès aux articles et catégories (specs/SPEC-articles.md). Les droits sont vérifiés par
// l'appelant (exigerSession() dans les actions d'administration).

export type LigneArticleAdmin = {
  id: string;
  slug: string;
  titre: string;
  statut: "brouillon" | "publie";
  categorie: string | null;
  publieLe: number | null;
  modifieLe: number;
};

/** Liste de l'administration : brouillons d'abord (les plus récents en haut), puis publiés. */
export async function listerArticlesAdmin(): Promise<LigneArticleAdmin[]> {
  return (await db())
    .select({
      id: article.id,
      slug: article.slug,
      titre: article.titre,
      statut: article.statut,
      categorie: categorie.nom,
      publieLe: article.publieLe,
      modifieLe: article.modifieLe,
    })
    .from(article)
    .leftJoin(categorie, eq(article.categorieId, categorie.id))
    .orderBy(sql`CASE ${article.statut} WHEN 'brouillon' THEN 0 ELSE 1 END`, desc(article.modifieLe));
}

// ---------------------------------------------------------------------------------------------
// Site public (T8) : seuls les articles publiés sortent d'ici.

export type ArticlePublic = {
  slug: string;
  titre: string;
  resume: string;
  categorie: string | null;
  categorieSlug: string | null;
  publieLe: number;
};

export type ArticleComplet = ArticlePublic & { contenuHtml: string; modifieLe: number };

const colonnesPubliques = {
  slug: article.slug,
  titre: article.titre,
  resume: article.resume,
  categorie: categorie.nom,
  categorieSlug: categorie.slug,
  publieLe: article.publieLe,
};

/**
 * Articles publiés, du plus récent au plus ancien (EF-06). `limite` pour l'accueil,
 * `categorieId` pour le filtre de /conseils (EF-08).
 */
export async function listerArticlesPublies(limite?: number, categorieId?: string): Promise<ArticlePublic[]> {
  const publies = eq(article.statut, "publie");
  const requete = (await db())
    .select(colonnesPubliques)
    .from(article)
    .leftJoin(categorie, eq(article.categorieId, categorie.id))
    .where(categorieId ? and(publies, eq(article.categorieId, categorieId)) : publies)
    .orderBy(desc(article.publieLe));
  const lignes = limite ? await requete.limit(limite) : await requete;
  return lignes.map((l) => ({ ...l, publieLe: l.publieLe ?? 0 }));
}

/** Article publié par son adresse, ou null (brouillon ou inconnu → 404). */
export async function articlePublieParSlug(slug: string): Promise<ArticleComplet | null> {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null; // adresse impossible : inutile d'interroger la base
  const ligne = await (await db())
    .select({ ...colonnesPubliques, contenuHtml: article.contenuHtml, modifieLe: article.modifieLe })
    .from(article)
    .leftJoin(categorie, eq(article.categorieId, categorie.id))
    .where(and(eq(article.slug, slug), eq(article.statut, "publie")))
    .get();
  return ligne ? { ...ligne, publieLe: ligne.publieLe ?? 0 } : null;
}

/** Catégories ayant au moins un article publié : les filtres proposés aux visiteurs. */
export async function listerCategoriesPubliees(): Promise<Pick<Categorie, "nom" | "slug">[]> {
  return (await db())
    .selectDistinct({ nom: categorie.nom, slug: categorie.slug })
    .from(categorie)
    .innerJoin(article, and(eq(article.categorieId, categorie.id), eq(article.statut, "publie")))
    .orderBy(asc(categorie.nom));
}

/** Catégorie par son adresse, ou null (adresse mal formée ou inconnue → 404). */
export async function categorieParSlug(slug: string): Promise<Categorie | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return (await (await db()).select().from(categorie).where(eq(categorie.slug, slug)).get()) ?? null;
}

export async function listerCategories(): Promise<Categorie[]> {
  return (await db()).select().from(categorie).orderBy(asc(categorie.nom));
}

/** Catégorie existante par son id, ou null. */
export async function categorieParId(id: string): Promise<Categorie | null> {
  return (await (await db()).select().from(categorie).where(eq(categorie.id, id)).get()) ?? null;
}

/** Catégorie au nom donné : réutilisée si elle existe déjà (même adresse), créée sinon. */
export async function categorieParNom(nom: string): Promise<Categorie> {
  const base = await db();
  const slug = creerSlug(nom);
  const existante = await base.select().from(categorie).where(eq(categorie.slug, slug)).get();
  if (existante) return existante;
  const nouvelle = { id: crypto.randomUUID(), nom, slug, creeLe: Date.now() };
  await base.insert(categorie).values(nouvelle);
  return nouvelle;
}

export type NouvelArticle = {
  titre: string;
  resume: string;
  categorieId: string | null;
  contenuJson: string;
  contenuHtml: string;
};

/** Crée un article (brouillon ou publié) et renvoie son adresse. */
export async function creerArticle(donnees: NouvelArticle, publier: boolean): Promise<string> {
  const base = await db();
  const existants = new Set((await base.select({ slug: article.slug }).from(article)).map((l) => l.slug));
  const slug = slugPourEnregistrement({ titre: donnees.titre, slugActuel: null, dejaPublie: false, existants });
  const maintenant = Date.now();
  await base.insert(article).values({
    id: crypto.randomUUID(),
    slug, // déjà unique (slugPourEnregistrement)
    ...donnees,
    statut: publier ? "publie" : "brouillon",
    publieLe: publier ? maintenant : null,
    creeLe: maintenant,
    modifieLe: maintenant,
  });
  return slug;
}

// ---------------------------------------------------------------------------------------------
// Modification, dépublication, suppression (T9, EF-10).

export type ArticleEdition = {
  id: string;
  slug: string;
  titre: string;
  resume: string;
  categorieId: string | null;
  contenuJson: string;
  statut: "brouillon" | "publie";
  publieLe: number | null;
};

/** Article à modifier, quel que soit son statut, ou null. */
export async function articleParId(id: string): Promise<ArticleEdition | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return null;
  const ligne = await (await db())
    .select({
      id: article.id,
      slug: article.slug,
      titre: article.titre,
      resume: article.resume,
      categorieId: article.categorieId,
      contenuJson: article.contenuJson,
      statut: article.statut,
      publieLe: article.publieLe,
    })
    .from(article)
    .where(eq(article.id, id))
    .get();
  return ligne ?? null;
}

/**
 * Enregistre une nouvelle version d'un article existant et renvoie son adresse, ou null s'il
 * n'existe plus. `publier: false` sur un article publié le dépublie (retour en brouillon, rien
 * n'est perdu).
 *
 * `publieLe` est conservé à la dépublication : il marque « déjà publié une fois », ce qui fige
 * l'adresse (EF-07), et une republication garde la date d'origine.
 */
export async function modifierArticle(
  actuel: Pick<ArticleEdition, "id" | "slug" | "publieLe">,
  donnees: NouvelArticle,
  publier: boolean,
): Promise<string | null> {
  const base = await db();
  const existants = new Set((await base.select({ slug: article.slug }).from(article)).map((l) => l.slug));
  const slug = slugPourEnregistrement({
    titre: donnees.titre,
    slugActuel: actuel.slug,
    dejaPublie: actuel.publieLe !== null,
    existants,
  });
  const maintenant = Date.now();
  const modifies = await base
    .update(article)
    .set({
      ...donnees,
      slug,
      statut: publier ? "publie" : "brouillon",
      publieLe: actuel.publieLe ?? (publier ? maintenant : null),
      modifieLe: maintenant,
    })
    .where(eq(article.id, actuel.id))
    .returning({ id: article.id });
  return modifies.length > 0 ? slug : null;
}

/** Supprime définitivement un article. Renvoie false s'il n'existait déjà plus. */
export async function supprimerArticle(id: string): Promise<boolean> {
  const supprimes = await (await db()).delete(article).where(eq(article.id, id)).returning({ id: article.id });
  return supprimes.length > 0;
}
