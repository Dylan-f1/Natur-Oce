import type { Metadata } from "next";
import { connection } from "next/server";
import { listerArticlesPublies, listerCategoriesPubliees } from "@/lib/db/articles";
import { ListeConseils } from "./ListeConseils";
import "./conseils.css";

export const metadata: Metadata = {
  title: "Conseils",
  description: "Les conseils d’Océane, naturopathe : hygiène de vie, alimentation, récupération et sport.",
  alternates: { canonical: "/conseils" },
};

// Tous les conseils publiés, du plus récent au plus ancien (EF-06). Le filtre par catégorie
// (EF-08) est sur /conseils/categorie/<slug>.
export default async function Conseils() {
  await connection(); // rendu à la demande ; en ligne, servi en fichier statique (D-21)
  const [articles, categories] = await Promise.all([listerArticlesPublies(), listerCategoriesPubliees()]);
  return <ListeConseils articles={articles} categories={categories} />;
}
