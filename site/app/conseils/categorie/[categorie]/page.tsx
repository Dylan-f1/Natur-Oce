import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { categorieParSlug, listerArticlesPublies, listerCategoriesPubliees } from "@/lib/db/articles";
import { ListeConseils } from "../../ListeConseils";
import "../../conseils.css";

// Conseils d'une catégorie (EF-08). Catégorie inconnue ou adresse mal formée → 404 ; catégorie
// sans article publié → message et lien vers tous les conseils.

/** Une seule lecture en base par visite, partagée entre les métadonnées et la page. */
const lireCategorie = cache(categorieParSlug);

export async function generateMetadata({ params }: PageProps<"/conseils/categorie/[categorie]">): Promise<Metadata> {
  await connection();
  const filtre = await lireCategorie((await params).categorie);
  if (!filtre) return { title: "Catégorie introuvable" };
  return {
    title: `Conseils : ${filtre.nom}`,
    description: `Les conseils d’Océane, naturopathe, dans la catégorie « ${filtre.nom} ».`,
    alternates: { canonical: `/conseils/categorie/${filtre.slug}` },
  };
}

export default async function ConseilsCategorie({ params }: PageProps<"/conseils/categorie/[categorie]">) {
  await connection();
  const filtre = await lireCategorie((await params).categorie);
  if (!filtre) notFound();

  const [articles, categories] = await Promise.all([
    listerArticlesPublies(undefined, filtre.id),
    listerCategoriesPubliees(),
  ]);
  return <ListeConseils articles={articles} categories={categories} filtre={filtre} />;
}
