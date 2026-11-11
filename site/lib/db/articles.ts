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

/** Articles publiés, du plus récent au plus ancien (EF-06). `limite` pour l'accueil. */
export async function listerArticlesPublies(limite?: number): Promise<ArticlePublic[]> {
  const requete = (await db())
    .select(colonnesPubliques)
    .from(article)
    .leftJoin(categorie, eq(article.categorieId, categorie.id))
    .where(eq(article.statut, "publie"))
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
