"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import "../conseils/conseils.css";

// Articles ouverts dans une fenêtre (T16, option A du 12/11, design/propositions.html) : depuis
// l'accueil ou une liste de conseils, un clic sur un article l'ouvre par-dessus la page, et
// l'adresse devient /conseils/<slug> (partageable). Le contenu vient de la page de l'article, servie
// en fichier statique (D-21) : rien d'autre à charger. Ouverte directement, depuis Google ou sans
// JavaScript, l'adresse reste une page entière. Échap, « Fermer », un clic à côté ou le bouton
// retour referment, et le clavier revient sur la planche.

const ARTICLE = /^\/conseils\/[a-z0-9-]+$/; // pas /conseils/categorie/… (deux segments)
const rien = () => () => {};
const useAuNavigateur = () => useSyncExternalStore(rien, () => true, () => false);

type Etat = { href: string; html: string | null };

export function FenetreArticles() {
  const navigateur = useAuNavigateur();
  const fenetre = useRef<HTMLDialogElement>(null);
  const origine = useRef<HTMLElement | null>(null);
  const titreAvant = useRef("");
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    async function ouvrir(href: string, depuis: HTMLElement) {
      origine.current = depuis;
      titreAvant.current = document.title;
      setEtat({ href, html: null });
      fenetre.current?.showModal();
      fenetre.current?.querySelector(".fenetre-defile")?.scrollTo(0, 0);
      document.documentElement.classList.add("fenetre-ouverte");
      history.pushState({ fenetreArticle: true }, "", href);
      try {
        const reponse = await fetch(href, { headers: { Accept: "text/html" } });
        if (!reponse.ok) throw new Error(String(reponse.status));
        const page = new DOMParser().parseFromString(await reponse.text(), "text/html");
        const article = page.querySelector("article.lecture");
        if (!article) throw new Error("article introuvable");
        article.querySelectorAll(".fil-ariane, .retour-conseils").forEach((e) => e.remove());
        article.querySelector("h1")?.setAttribute("id", "fenetre-article-titre");
        document.title = page.title || document.title;
        setEtat({ href, html: article.innerHTML });
      } catch {
        location.assign(href); // en cas de souci, la page entière
      }
    }

    function surClic(ev: MouseEvent) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const lien = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = lien?.getAttribute("href");
      if (!lien || !href || !ARTICLE.test(href) || lien.closest(".fenetre-article")) return;
      ev.preventDefault();
      void ouvrir(href, lien);
    }

    // Bouton retour : la fenêtre se ferme, l'adresse est déjà revenue à la page d'avant.
    function surRetour() {
      if (fenetre.current?.open) fenetre.current.close();
    }

    document.addEventListener("click", surClic);
    addEventListener("popstate", surRetour);
    return () => {
      document.removeEventListener("click", surClic);
      removeEventListener("popstate", surRetour);
    };
  }, []);

  /** Échap, « Fermer » ou clic à côté : on revient dans l'historique, ce qui referme la fenêtre. */
  function fermer() {
    if (history.state?.fenetreArticle) history.back();
    else fenetre.current?.close();
  }

  function apresFermeture() {
    document.documentElement.classList.remove("fenetre-ouverte");
    if (titreAvant.current) document.title = titreAvant.current;
    setEtat(null);
    origine.current?.focus();
  }

  if (!navigateur) return null;
  return createPortal(
    <dialog ref={fenetre} className="fenetre fenetre-article" aria-labelledby={etat?.html ? "fenetre-article-titre" : "fenetre-article-chargement"}
      onCancel={(ev) => { ev.preventDefault(); fermer(); }}
      onClose={apresFermeture}
      onClick={(ev) => { if (ev.target === ev.currentTarget) fermer(); }}>
      <div className="fenetre-defile">
        <div className="fenetre-barre">
          <span className="fenetre-rubrique">Conseils</span>
          <div className="fenetre-actions">
            {etat && <a className="fenetre-page" href={etat.href}>Page entière</a>}
            <button type="button" className="fenetre-fermer" onClick={fermer}>Fermer</button>
          </div>
        </div>
        <div className="fenetre-corps">
          {etat?.html ? (
            // HTML de notre propre page d'article, fabriqué en liste blanche (lib/articles/rendu.ts).
            <article className="lecture" dangerouslySetInnerHTML={{ __html: etat.html }} />
          ) : (
            <p id="fenetre-article-chargement" role="status">Chargement de l’article…</p>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
