import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { articleParId, listerCategories } from "@/lib/db/articles";
import { exigerSession } from "@/lib/session";
import { enregistrerArticle, supprimerArticleAction } from "../actions";
import { FormulaireArticle } from "../FormulaireArticle";
import { SupprimerArticle } from "../SupprimerArticle";

// Modifier un article existant (EF-10) : même formulaire que la création, adresse conservée
// une fois l'article publié (EF-07), « Dépublier » et « Supprimer ».

const lireArticle = cache(articleParId);

export async function generateMetadata({ params }: PageProps<"/admin/articles/[id]">): Promise<Metadata> {
  await exigerSession();
  const article = await lireArticle((await params).id);
  return { title: article ? `Modifier « ${article.titre} »` : "Article introuvable" };
}

export default async function ModifierArticle({ params, searchParams }: PageProps<"/admin/articles/[id]">) {
  await exigerSession();
  const [{ id }, p] = await Promise.all([params, searchParams]);
  const [article, categories] = await Promise.all([lireArticle(id), listerCategories()]);
  if (!article) notFound();

  const publie = article.statut === "publie";

  return (
    <>
      <p className="fil"><Link href="/admin">Articles</Link> / Modifier</p>
      <h1>{article.titre}</h1>
      <p className="aide etat-article">
        {publie ? (
          <>En ligne à l’adresse <Link href={`/conseils/${article.slug}`}>/conseils/{article.slug}</Link>.</>
        ) : (
          "Brouillon : pas visible sur le site."
        )}
      </p>

      {p.erreur === "suppression" && (
        <p role="alert" className="message-erreur">La suppression a échoué. Réessayez dans un instant.</p>
      )}

      <FormulaireArticle
        key={article.id}
        action={enregistrerArticle.bind(null, article.id)}
        categories={categories}
        statut={article.statut}
        initial={{
          titre: article.titre,
          resume: article.resume,
          categorieId: article.categorieId ?? "",
          nouvelleCategorie: "",
          contenu: article.contenuJson,
        }}
      />

      <SupprimerArticle titre={article.titre} supprimer={supprimerArticleAction.bind(null, article.id)} />
    </>
  );
}
