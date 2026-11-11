import type { Metadata } from "next";
import { EnTete } from "../../_composants/EnTete";
import { PiedDePage } from "../../_composants/PiedDePage";
import "../contact.css";

export const metadata: Metadata = { title: "Demande non envoyée", robots: { index: false, follow: false } };

// Après un échec sans JavaScript (limite d'envois atteinte ou envoi impossible). Page figée par
// l'instantané (D-21) : elle ne peut pas dire laquelle des deux causes, elle donne les deux issues.
export default function DemandeNonEnvoyee() {
  return (
    <>
      <EnTete />
      <main className="cadre page-retour">
        <h1 className="titre-page">Votre demande n’est pas partie</h1>
        <p>
          Plusieurs demandes ont peut-être déjà été envoyées depuis votre connexion dans l’heure, ou l’envoi a eu un
          souci passager.
        </p>
        <p>
          Revenez en arrière avec le bouton «&nbsp;Retour&nbsp;» de votre navigateur : votre message y est encore. Vous
          pouvez aussi écrire à <a href="mailto:contact@natur-oce.fr">contact@natur-oce.fr</a>.
        </p>
      </main>
      <PiedDePage />
    </>
  );
}
