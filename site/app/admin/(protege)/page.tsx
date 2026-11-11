import Link from "next/link";
import { listerArticlesAdmin } from "@/lib/db/articles";
import { etatPublication, lireIssue, type EtatSite } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { MessageEnregistrement } from "./MessageSite";
import { relancerPublication } from "./publication";

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

function EtatDuSite({ etat }: { etat: EtatSite }) {
  if (!etat.configuree) return null;
  const d = etat.derniere;
  const texte =
    d === null ? "Aucune mise à jour du site public pour l’instant."
    : d === "inconnu" ? "État de la dernière mise à jour indisponible pour le moment."
    : d.etat === "en_cours" ? "Mise à jour du site public en cours…"
    : d.etat === "faite" ? `Site public à jour depuis le ${dateHeure.format(d.le)}.`
    : `La dernière mise à jour du site public a échoué (${dateHeure.format(d.le)}) : il garde la version précédente.`;
  return (
    <form action={relancerPublication} className="etat-site" data-etat={d === null || d === "inconnu" ? d ?? "aucune" : d.etat}>
      <p data-testid="etat-site">{texte}</p>
      <button type="submit" className="bouton-secondaire">Mettre à jour le site</button>
    </form>
  );
}

// Accueil de l'administration : la liste des articles (EF-09). Brouillons en premier.
export default async function Administration({ searchParams }: PageProps<"/admin">) {
  const session = await exigerSession(); // aussi dans la mise en page : chaque page vérifie elle-même
  const [articles, p, etat] = await Promise.all([listerArticlesAdmin(), searchParams, etatPublication()]);
  const issue = lireIssue(p.site);
  const message = p.publie
    ? "L’article est publié."
    : p.modifie
      ? "Les modifications sont enregistrées."
      : p.depublie
        ? "L’article est dépublié : il reste dans vos brouillons."
        : p.supprime
          ? "L’article est supprimé."
          : p.enregistre
            ? "Le brouillon est enregistré."
            : issue
              ? "Demande de mise à jour du site envoyée."
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

      {message && <MessageEnregistrement message={message} issue={issue} />}

      <EtatDuSite etat={etat} />

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
