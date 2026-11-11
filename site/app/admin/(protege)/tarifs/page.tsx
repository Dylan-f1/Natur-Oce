import type { Metadata } from "next";
import { lireTarifs } from "@/lib/db/tarifs";
import type { Tarif } from "@/lib/db/schema";
import { lireIssue } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { prixPourSaisie } from "@/lib/tarifs";
import { MessageEnregistrement } from "../MessageSite";
import { FormulaireTarifs } from "./FormulaireTarifs";

export const metadata: Metadata = { title: "Tarifs" };

// Tarifs des séances (EF-12) : affichés dans « Une séance » sur l'accueil, dans cet ordre.
export default async function Tarifs({ searchParams }: PageProps<"/admin/tarifs">) {
  await exigerSession();
  const p = await searchParams;
  const issue = lireIssue(p.site);

  // Si la base ne répond pas, on le dit et on n'affiche pas le formulaire : une liste vide prise
  // pour la vraie, puis enregistrée, effacerait les tarifs d'Océane.
  let tarifs: Tarif[] | null;
  try {
    tarifs = await lireTarifs();
  } catch (erreur) {
    console.error("[tarifs] lecture impossible dans l'administration", erreur);
    tarifs = null;
  }

  return (
    <>
      <h1>Tarifs</h1>
      <p className="aide intro-tarifs">
        Affichés sur l’accueil, dans la partie «&nbsp;Une séance&nbsp;», dans cet ordre. Sans aucun tarif, l’accueil indique
        «&nbsp;Tarifs sur demande&nbsp;».
      </p>
      {p.enregistre && <MessageEnregistrement message="Les tarifs sont enregistrés." issue={issue} />}
      {tarifs === null ? (
        <p role="alert" className="message-erreur">
          Les tarifs n’ont pas pu être lus. Rien n’a été modifié : rechargez la page dans un instant.
        </p>
      ) : (
        <FormulaireTarifs
          initial={tarifs.map((t) => ({
            id: t.id,
            libelle: t.libelle,
            duree: t.dureeMinutes === null ? "" : String(t.dureeMinutes),
            prix: prixPourSaisie(t.prixCentimes),
          }))}
        />
      )}
    </>
  );
}
