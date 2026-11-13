import type { ArticlePublic } from "@/lib/db/articles";
import type { Categorie } from "@/lib/db/schema";
import { EnTete } from "../_composants/EnTete";
import { FenetreArticles } from "../_composants/FenetreArticles";
import { PiedDePage } from "../_composants/PiedDePage";
import { PlancheArticle } from "../_composants/PlancheArticle";

type Props = {
  articles: ArticlePublic[];
  /** Catégories ayant au moins un article publié : les filtres proposés. */
  categories: Pick<Categorie, "nom" | "slug">[];
  /** Catégorie choisie, ou undefined pour « Tous ». */
  filtre?: Pick<Categorie, "nom" | "slug">;
};

// Liste des conseils, commune à /conseils et /conseils/categorie/<slug> (EF-06, EF-08).
// Le filtre est dans le chemin, pas dans `?categorie=` : les pages publiques sont des fichiers
// statiques, qui ignorent la chaîne de requête (D-21).
export function ListeConseils({ articles, categories, filtre }: Props) {
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
                <a href="/conseils" aria-current={filtre ? undefined : "page"}>Tous</a>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <a href={`/conseils/categorie/${c.slug}`} aria-current={filtre?.slug === c.slug ? "page" : undefined}>
                    {c.nom}
                  </a>
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
            <a href="/conseils">Voir tous les conseils</a>
          </p>
        ) : (
          <p className="sans-article">Les premiers conseils arrivent bientôt.</p>
        )}
      </main>
      <PiedDePage />
      <FenetreArticles />
    </>
  );
}
