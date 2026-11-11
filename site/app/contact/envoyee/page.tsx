import type { Metadata } from "next";
import { EnTete } from "../../_composants/EnTete";
import { PiedDePage } from "../../_composants/PiedDePage";
import "../contact.css";

export const metadata: Metadata = { title: "Demande envoyée", robots: { index: false, follow: false } };

// Après un envoi réussi sans JavaScript (avec JavaScript, la confirmation s'affiche à la place du
// formulaire). Page figée par l'instantané (D-21).
export default function DemandeEnvoyee() {
  return (
    <>
      <EnTete />
      <main className="cadre page-retour">
        <h1 className="titre-page">Votre demande est envoyée</h1>
        <p>Merci. Océane vous répond par mail pour fixer la séance en visio.</p>
        <p><a href="/">Revenir à l’accueil</a></p>
      </main>
      <PiedDePage />
    </>
  );
}
