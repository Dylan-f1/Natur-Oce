import type { Metadata } from "next";
import { connection } from "next/server";
import { listerArticlesPublies } from "@/lib/db/articles";
import { EnTete } from "../_composants/EnTete";
import { PiedDePage } from "../_composants/PiedDePage";
import { PlancheArticle } from "../_composants/PlancheArticle";
import "./conseils.css";

export const metadata: Metadata = {
  title: "Conseils",
  description: "Les conseils d’Océane, naturopathe : hygiène de vie, alimentation, récupération et sport.",
  alternates: { canonical: "/conseils" },
};

// Liste des conseils publiés, du plus récent au plus ancien (EF-06). Le filtre par catégorie
// (EF-08) arrive avec T9.
export default async function Conseils() {
  await connection(); // les articles viennent de D1 à chaque visite
  const articles = await listerArticlesPublies();

  return (
    <>
      <EnTete />
      <main className="cadre page-conseils">
        <h1 className="titre-page">Conseils</h1>
        <p className="intro-page">
          Des repères pour votre hygiène de vie, et pour celles et ceux qui font du sport.
        </p>
        {articles.length === 0 ? (
          <p className="sans-article">Les premiers conseils arrivent bientôt.</p>
        ) : (
          <div className="planches">
            {articles.map((a) => (
              <PlancheArticle key={a.slug} article={a} />
            ))}
          </div>
        )}
      </main>
      <PiedDePage />
    </>
  );
}
