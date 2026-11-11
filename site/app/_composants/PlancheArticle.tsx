import type { ArticlePublic } from "@/lib/db/articles";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Une « planche » d'article (direction L'herbier) : catégorie, titre, date (EF-06). */
export function PlancheArticle({ article }: { article: ArticlePublic }) {
  return (
    <a className="planche" href={`/conseils/${article.slug}`}>
      {article.categorie && <span className="categorie">{article.categorie}</span>}
      <h3>{article.titre}</h3>
      <time dateTime={new Date(article.publieLe).toISOString()}>{dateLongue.format(article.publieLe)}</time>
    </a>
  );
}

export function formaterDateArticle(ms: number): string {
  return dateLongue.format(ms);
}
