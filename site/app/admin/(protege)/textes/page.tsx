import type { Metadata } from "next";
import { lireTextes } from "@/lib/db/textes";
import { lireIssue } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import type { Textes } from "@/lib/textes";
import { MessageEnregistrement } from "../MessageSite";
import { FormulaireTextes } from "./FormulaireTextes";

export const metadata: Metadata = { title: "Textes de l’accueil" };

// Textes de l'accueil (EF-19, specs/SPEC-textes.md) : seulement les mots, jamais la mise en page.
export default async function TextesAccueil({ searchParams }: PageProps<"/admin/textes">) {
  await exigerSession();
  const p = await searchParams;
  const issue = lireIssue(p.site);

  // Si la base ne répond pas, pas de formulaire : des champs pris pour les vrais, puis enregistrés,
  // écraseraient les textes d'Océane (même règle que les tarifs).
  let textes: Textes | null;
  try {
    textes = await lireTextes();
  } catch (erreur) {
    console.error("[textes] lecture impossible dans l'administration", erreur);
    textes = null;
  }

  return (
    <>
      <h1>Textes de l’accueil</h1>
      <p className="aide intro-tarifs">
        Les textes de votre présentation, rangés comme sur l’accueil. Seuls les mots changent : la mise en page reste
        la même. Un champ vide n’affiche rien sur le site.
      </p>
      <div className="message-info charte">
        <p>
          <strong>Rappel de la charte.</strong> Pas de «&nbsp;guérir&nbsp;» ni de «&nbsp;traiter&nbsp;», jamais de
          conseil d’arrêter un traitement. Parlez d’hygiène de vie pour les sportifs (alimentation, récupération),
          pas d’encadrement de séances de sport.
        </p>
      </div>
      {p.enregistre && <MessageEnregistrement message="Les textes sont enregistrés." issue={issue} />}
      {textes === null ? (
        <p role="alert" className="message-erreur">
          Les textes n’ont pas pu être lus. Rien n’a été modifié : rechargez la page dans un instant.
        </p>
      ) : (
        <FormulaireTextes initial={textes} />
      )}
    </>
  );
}
