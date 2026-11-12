"use client";

import { createContext, useContext } from "react";
import { ZONES, type Zone } from "@/lib/textes";

// Crayon de « Mon accueil » (EF-20) : affiché seulement en mode édition, il demande à l'éditeur
// (app/admin/(apercu)/accueil/EditeurAccueil.tsx) d'ouvrir le panneau de sa zone.

export const OuvrirZone = createContext<((zone: Zone, depuis: HTMLElement) => void) | null>(null);

export function Crayon({ zone }: { zone: Zone }) {
  const ouvrir = useContext(OuvrirZone);
  if (!ouvrir) return null;
  return (
    <button type="button" className="crayon" data-edition="" onClick={(ev) => ouvrir(zone, ev.currentTarget)}
      aria-label={`Modifier « ${ZONES[zone].titre} »`}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <span>Modifier</span>
    </button>
  );
}
