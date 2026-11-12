import type { Metadata } from "next";
import { EnTete } from "../_composants/EnTete";
import { PiedDePage } from "../_composants/PiedDePage";
import { CHAPEAU_CONFIDENTIALITE, TexteConfidentialite } from "../_composants/TexteConfidentialite";
import "./confidentialite.css";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Les données recueillies par natur-oce.fr, pourquoi, combien de temps, et vos droits (RGPD).",
  alternates: { canonical: "/confidentialite" },
};

// Page de la politique de confidentialité : pour les liens directs et sans JavaScript. Depuis le
// pied de page, elle s'ouvre dans une fenêtre (demande de Dylan du 12/11). Figée par l'instantané.
export default function Confidentialite() {
  return (
    <>
      <EnTete />
      <main className="cadre page-texte">
        <h1 className="titre-page">Confidentialité</h1>
        <p className="chapeau-texte">{CHAPEAU_CONFIDENTIALITE}</p>
        <TexteConfidentialite />
      </main>
      <PiedDePage />
    </>
  );
}
