import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { articlePublieParSlug } from "@/lib/db/articles";
import { EnTete } from "../../_composants/EnTete";
import { PiedDePage } from "../../_composants/PiedDePage";
import { formaterDateArticle } from "../../_composants/PlancheArticle";
import "../conseils.css";

// Page d'un article publié (EF-07). Un brouillon ou une adresse inconnue → 404.

/** Une seule lecture en base par visite, partagée entre les métadonnées et la page. */
const lireArticle = cache(articlePublieParSlug);

export async function generateMetadata({ params }: PageProps<"/conseils/[slug]">): Promise<Metadata> {
  await connection();
  const article = await lireArticle((await params).slug);
  if (!article) return { title: "Article introuvable" };
  return {
    title: article.titre,
    description: article.resume, // obligatoire pour publier (ENF-07)
    alternates: { canonical: `/conseils/${article.slug}` },
    openGraph: { type: "article", title: article.titre, description: article.resume },
  };
}

export default async function PageArticle({ params }: PageProps<"/conseils/[slug]">) {
  await connection();
  const article = await lireArticle((await params).slug);
  if (!article) notFound();

  return (
    <>
      <EnTete />
      <main className="cadre page-conseils">
        <article className="lecture">
          <p className="fil-ariane"><Link href="/conseils">Conseils</Link></p>
          <h1 className="titre-page">{article.titre}</h1>
          <dl className="lecture-etiquette">
            {article.categorie && (
              <>
                <dt>Catégorie</dt>
                <dd>
                  {article.categorieSlug ? (
                    <Link href={`/conseils?categorie=${article.categorieSlug}`}>{article.categorie}</Link>
                  ) : (
                    article.categorie
                  )}
                </dd>
              </>
            )}
            <dt>Publié le</dt>
            <dd><time dateTime={new Date(article.publieLe).toISOString()}>{formaterDateArticle(article.publieLe)}</time></dd>
          </dl>
          {article.resume && <p className="lecture-resume">{article.resume}</p>}

          {/* HTML fabriqué à l'enregistrement par le rendu en liste blanche (lib/articles/rendu.ts) :
              aucun HTML saisi n'arrive tel quel ici. */}
          <div className="corps-article" dangerouslySetInnerHTML={{ __html: article.contenuHtml }} />

          <p className="avert-article">
            La naturopathie ne remplace pas un avis médical : continuez vos traitements et consultez
            votre médecin.
          </p>
          <Link className="retour-conseils" href="/conseils">Tous les conseils</Link>
        </article>
      </main>
      <PiedDePage />
    </>
  );
}
