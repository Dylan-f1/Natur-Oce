import Link from "next/link";
import { listerArticlesAdmin } from "@/lib/db/articles";
import { exigerSession } from "@/lib/session";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Accueil de l'administration : la liste des articles (EF-09). Brouillons en premier.
export default async function Administration({ searchParams }: PageProps<"/admin">) {
  const session = await exigerSession(); // aussi dans la mise en page : chaque page vérifie elle-même
  const [articles, p] = await Promise.all([listerArticlesAdmin(), searchParams]);
  const message = p.publie
    ? "L’article est publié."
    : p.modifie
      ? "Les modifications sont en ligne."
      : p.depublie
        ? "L’article n’est plus en ligne : il reste dans vos brouillons."
        : p.supprime
          ? "L’article est supprimé."
          : p.enregistre
            ? "Le brouillon est enregistré."
            : null;

  return (
    <>
      <div className="admin-titre">
        <div>
          <h1>Articles</h1>
          <p className="aide" data-testid="connectee">Connectée avec {session.user.email}.</p>
        </div>
        <Link href="/admin/articles/nouveau" className="bouton">Nouvel article</Link>
      </div>

      {message && <p role="status" className="message-info">{message}</p>}

      {articles.length === 0 ? (
        <p className="vide">Aucun article pour l’instant. Commencez par « Nouvel article ».</p>
      ) : (
        <ul className="liste-articles">
          {articles.map((a) => (
            <li key={a.id} data-statut={a.statut}>
              <span className={`pastille pastille-${a.statut}`}>{a.statut === "publie" ? "Publié" : "Brouillon"}</span>
              <Link className="liste-titre" href={`/admin/articles/${a.id}`}>{a.titre}</Link>
              <span className="liste-meta">
                {a.categorie ?? "Sans catégorie"},{" "}
                {a.statut === "publie" && a.publieLe
                  ? `publié le ${dateCourte.format(a.publieLe)}`
                  : `modifié le ${dateCourte.format(a.modifieLe)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
