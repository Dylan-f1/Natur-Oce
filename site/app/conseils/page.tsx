import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { categorieParSlug, listerArticlesPublies, listerCategoriesPubliees } from "@/lib/db/articles";
import { EnTete } from "../_composants/EnTete";
import { PiedDePage } from "../_composants/PiedDePage";
import { PlancheArticle } from "../_composants/PlancheArticle";
import "./conseils.css";

const DESCRIPTION = "Les conseils d’Océane, naturopathe : hygiène de vie, alimentation, récupération et sport.";

/** Catégorie demandée par `?categorie=` : undefined sans filtre, null si inconnue (→ 404). */
const lireFiltre = cache(async (valeur: string | string[] | undefined) => {
  if (valeur === undefined) return undefined;
  return typeof valeur === "string" ? categorieParSlug(valeur) : null;
});

export async function generateMetadata({ searchParams }: PageProps<"/conseils">): Promise<Metadata> {
  await connection();
  const filtre = await lireFiltre((await searchParams).categorie);
  if (filtre === undefined) return { title: "Conseils", description: DESCRIPTION, alternates: { canonical: "/conseils" } };
  if (filtre === null) return { title: "Catégorie introuvable" };
  return {
    title: `Conseils : ${filtre.nom}`,
    description: `Les conseils d’Océane, naturopathe, dans la catégorie « ${filtre.nom} ».`,
    alternates: { canonical: `/conseils?categorie=${filtre.slug}` },
  };
}

// Liste des conseils publiés, du plus récent au plus ancien (EF-06), filtrable par catégorie
// (EF-08). Seules les catégories ayant un article publié sont proposées.
export default async function Conseils({ searchParams }: PageProps<"/conseils">) {
  await connection(); // les articles viennent de D1 à chaque visite
  const filtre = await lireFiltre((await searchParams).categorie);
  if (filtre === null) notFound();

  const [articles, categories] = await Promise.all([
    listerArticlesPublies(undefined, filtre?.id),
    listerCategoriesPubliees(),
  ]);
  const proposerFiltres = categories.length >= 2 || filtre !== undefined;

  return (
    <>
      <EnTete />
      <main className="cadre page-conseils">
        <h1 className="titre-page">Conseils</h1>
        <p className="intro-page">
          Des repères pour votre hygiène de vie, et pour celles et ceux qui font du sport.
        </p>

        {proposerFiltres && (
          <nav className="filtres" aria-label="Catégories">
            <ul>
              <li>
                <Link href="/conseils" aria-current={filtre ? undefined : "page"}>Tous</Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/conseils?categorie=${c.slug}`} aria-current={filtre?.slug === c.slug ? "page" : undefined}>
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {articles.length > 0 ? (
          <div className="planches">
            {articles.map((a) => (
              <PlancheArticle key={a.slug} article={a} />
            ))}
          </div>
        ) : filtre ? (
          <p className="sans-article">
            Aucun conseil publié dans cette catégorie pour l’instant.{" "}
            <Link href="/conseils">Voir tous les conseils</Link>
          </p>
        ) : (
          <p className="sans-article">Les premiers conseils arrivent bientôt.</p>
        )}
      </main>
      <PiedDePage />
    </>
  );
}
