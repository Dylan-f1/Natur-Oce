import type { Metadata } from "next";
import { lireReglages } from "@/lib/db/reglages";
import type { Reglages } from "@/lib/reglages";
import { exigerSession } from "@/lib/session";
import { FormulaireReglages } from "./FormulaireReglages";

export const metadata: Metadata = { title: "Réglages" };

// Réglages d'Océane (T21) : son lien de visio et la durée d'une séance, pour la confirmation en un clic.
export default async function ReglagesPage() {
  await exigerSession();

  // Base illisible : pas de formulaire (des champs vides enregistrés écraseraient les vrais réglages).
  let reglages: Reglages | null;
  try {
    reglages = await lireReglages();
  } catch (erreur) {
    console.error("[réglages] lecture impossible", erreur);
    reglages = null;
  }

  return (
    <>
      <h1>Réglages</h1>
      <p className="aide intro-tarifs">
        Ces deux informations servent à la confirmation d’un rendez-vous : un clic dans l’e-mail d’une demande, et le client
        reçoit sa confirmation avec votre lien de visio. Elles ne sont jamais affichées sur le site.
      </p>
      {reglages === null ? (
        <p role="alert" className="message-erreur">Les réglages n’ont pas pu être lus. Rien n’a été modifié : rechargez la page dans un instant.</p>
      ) : (
        <FormulaireReglages initial={{ lienVisio: reglages.lienVisio, dureeMinutes: String(reglages.dureeMinutes) }} />
      )}
    </>
  );
}
