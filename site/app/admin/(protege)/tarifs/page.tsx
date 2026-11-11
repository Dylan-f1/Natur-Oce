import type { Metadata } from "next";
import { listerTarifs } from "@/lib/db/tarifs";
import { lireIssue } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { prixPourSaisie } from "@/lib/tarifs";
import { MessageEnregistrement } from "../MessageSite";
import { FormulaireTarifs } from "./FormulaireTarifs";

export const metadata: Metadata = { title: "Tarifs" };

// Tarifs des séances (EF-12) : affichés dans « Une séance » sur l'accueil, dans cet ordre.
export default async function Tarifs({ searchParams }: PageProps<"/admin/tarifs">) {
  await exigerSession();
  const [tarifs, p] = await Promise.all([listerTarifs(), searchParams]);
  const issue = lireIssue(p.site);

  return (
    <>
      <h1>Tarifs</h1>
      <p className="aide intro-tarifs">
        Affichés sur l’accueil, dans la partie «&nbsp;Une séance&nbsp;», dans cet ordre. Sans aucun tarif, l’accueil indique
        «&nbsp;Tarifs sur demande&nbsp;».
      </p>
      {p.enregistre && <MessageEnregistrement message="Les tarifs sont enregistrés." issue={issue} />}
      <FormulaireTarifs
        initial={tarifs.map((t) => ({
          id: t.id,
          libelle: t.libelle,
          duree: t.dureeMinutes === null ? "" : String(t.dureeMinutes),
          prix: prixPourSaisie(t.prixCentimes),
        }))}
      />
    </>
  );
}
