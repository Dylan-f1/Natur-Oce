import { connection } from "next/server";
import { listerArticlesPublies } from "@/lib/db/articles";
import { listerSections } from "@/lib/db/sections";
import { listerTarifs } from "@/lib/db/tarifs";
import { listerTextes } from "@/lib/db/textes";
import { ContenuAccueil } from "./_composants/ContenuAccueil";
import { EnTete } from "./_composants/EnTete";
import { PiedDePage } from "./_composants/PiedDePage";

// Accueil public : les données viennent de D1 (textes EF-19, tarifs EF-12, 3 derniers articles
// EF-06), le contenu est dans _composants/ContenuAccueil.tsx (partagé avec « Mon accueil »).

/** Sans articles lisibles (base indisponible), l'accueil affiche « Les premiers conseils arrivent bientôt. » */
function erreurArticles(erreur: unknown) {
  console.error("[accueil] lecture des articles impossible", erreur);
  return [];
}

export default async function Accueil() {
  await connection(); // rendu à chaque visite en local ; figé en fichier par la publication (D-21)
  const [tarifs, textes, articles, sections] = await Promise.all([
    listerTarifs(),
    listerTextes(),
    listerArticlesPublies(3).catch(erreurArticles),
    listerSections(),
  ]);

  return (
    <>
      <EnTete />
      <main>
        <ContenuAccueil textes={textes} tarifs={tarifs} articles={articles} sections={sections} />
      </main>
      <PiedDePage />
    </>
  );
}
