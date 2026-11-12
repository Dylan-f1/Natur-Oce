"use client";

import { useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Fenêtre centrée (option A du 12/11, design/propositions.html) : un lien vers une vraie page qui,
// avec JavaScript, ouvre son contenu par-dessus la page en cours. Sans JavaScript, ou avec Ctrl /
// clic du milieu, le lien mène à la page. Échap, « Fermer » ou un clic à côté referment, et le
// clavier revient sur le lien. Sert à la confidentialité ; servira aux articles (T16).

type Props = { href: string; libelle: string; titre: string; children: ReactNode; className?: string };

// La fenêtre est placée sous <body> (portail) : elle n'hérite pas des styles de l'endroit du lien
// (pied de page en italique, listes en ligne…). Côté serveur, seul le lien existe.
const rien = () => () => {};
const useAuNavigateur = () => useSyncExternalStore(rien, () => true, () => false);

export function Fenetre({ href, libelle, titre, children, className }: Props) {
  const navigateur = useAuNavigateur();
  const fenetre = useRef<HTMLDialogElement>(null);
  const lien = useRef<HTMLAnchorElement>(null);
  const idTitre = `fenetre-${href.replace(/[^a-z0-9]+/gi, "-")}`;

  function ouvrir(ev: MouseEvent<HTMLAnchorElement>) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    const d = fenetre.current;
    if (!d) return;
    d.showModal();
    d.querySelector(".fenetre-defile")?.scrollTo(0, 0);
    document.documentElement.classList.add("fenetre-ouverte"); // la page derrière ne défile plus
  }

  function fermer() {
    fenetre.current?.close();
  }

  return (
    <>
      <a ref={lien} href={href} className={className} onClick={ouvrir}>{libelle}</a>
      {navigateur && createPortal(
      <dialog ref={fenetre} className="fenetre" aria-labelledby={idTitre}
        onClose={() => { document.documentElement.classList.remove("fenetre-ouverte"); lien.current?.focus(); }}
        onClick={(ev) => { if (ev.target === ev.currentTarget) fermer(); }}>
        <div className="fenetre-defile">
          <div className="fenetre-barre">
            <h2 id={idTitre} className="fenetre-titre">{titre}</h2>
            <button type="button" className="fenetre-fermer" onClick={fermer}>Fermer</button>
          </div>
          <div className="fenetre-corps">{children}</div>
        </div>
      </dialog>,
      document.body,
      )}
    </>
  );
}
