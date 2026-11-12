import type { Metadata } from "next";
import { ContenuAccueil } from "@/app/_composants/ContenuAccueil";
import { EnTete } from "@/app/_composants/EnTete";
import { PiedDePage } from "@/app/_composants/PiedDePage";
import { listerArticlesPublies } from "@/lib/db/articles";
import type { Tarif } from "@/lib/db/schema";
import { lireTarifs } from "@/lib/db/tarifs";
import { lireTextes } from "@/lib/db/textes";
import { exigerSession } from "@/lib/session";
import { prixPourSaisie } from "@/lib/tarifs";
import type { Textes } from "@/lib/textes";
import { EditeurAccueil } from "./EditeurAccueil";

export const metadata: Metadata = { title: "Mon accueil" };

// « Mon accueil » (EF-20, specs/SPEC-edition-visuelle.md) : le vrai rendu de l'accueil, avec un
// crayon par zone. Si la base ne répond pas, pas d'édition (rien ne doit écraser les vrais textes).
export default async function MonAccueil() {
  await exigerSession();

  let textes: Textes | null = null;
  let tarifs: Tarif[] | null = null;
  try {
    [textes, tarifs] = await Promise.all([lireTextes(), lireTarifs()]);
  } catch (erreur) {
    console.error("[mon accueil] lecture impossible", erreur);
  }
  if (!textes || !tarifs) {
    return (
      <main className="admin-cadre admin-contenu">
        <p role="alert" className="message-erreur">
          Votre accueil n’a pas pu être lu. Rien n’a été modifié : rechargez la page dans un instant.
        </p>
      </main>
    );
  }
  const articles = await listerArticlesPublies(3).catch(() => []);

  return (
    <EditeurAccueil
      textes={textes}
      tarifs={tarifs.map((t) => ({
        id: t.id,
        libelle: t.libelle,
        duree: t.dureeMinutes === null ? "" : String(t.dureeMinutes),
        prix: prixPourSaisie(t.prixCentimes),
      }))}
    >
      <EnTete />
      <main>
        <ContenuAccueil textes={textes} tarifs={tarifs} articles={articles} edition />
      </main>
      <PiedDePage />
    </EditeurAccueil>
  );
}
