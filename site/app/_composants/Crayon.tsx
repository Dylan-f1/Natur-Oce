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

// ---------------------------------------------------------------------------------------------
// Sections ajoutées (EF-21) : outils de chaque section et bouton « Ajouter une section ici ».

export type ActionsSections = {
  modifier: (id: string, depuis: HTMLElement) => void;
  deplacer: (id: string, sens: -1 | 1) => void;
  supprimer: (id: string, titre: string) => void;
  ajouter: (apres: string, depuis: HTMLElement) => void;
};

export const ActionsSection = createContext<ActionsSections | null>(null);

export function OutilsSection({ id, titre, premiere, derniere }: { id: string; titre: string; premiere: boolean; derniere: boolean }) {
  const actions = useContext(ActionsSection);
  if (!actions) return null;
  return (
    <div className="outils-section" data-edition="">
      <button type="button" className="crayon" onClick={(ev) => actions.modifier(id, ev.currentTarget)} aria-label={`Modifier « ${titre} »`}>
        <span>Modifier</span>
      </button>
      <button type="button" className="outil" onClick={() => actions.deplacer(id, -1)} disabled={premiere} aria-label={`Monter « ${titre} »`}>Monter</button>
      <button type="button" className="outil" onClick={() => actions.deplacer(id, 1)} disabled={derniere} aria-label={`Descendre « ${titre} »`}>Descendre</button>
      <button type="button" className="outil outil-danger" onClick={() => actions.supprimer(id, titre)} aria-label={`Supprimer « ${titre} »`}>Supprimer</button>
    </div>
  );
}

export function AjouterIci({ apres, libelle }: { apres: string; libelle: string }) {
  const actions = useContext(ActionsSection);
  if (!actions) return null;
  return (
    <div className="cadre ajouter-ici" data-edition="">
      <button type="button" className="ajouter-section" onClick={(ev) => actions.ajouter(apres, ev.currentTarget)}
        aria-label={`Ajouter une section après « ${libelle} »`}>
        + Ajouter une section ici
      </button>
    </div>
  );
}
