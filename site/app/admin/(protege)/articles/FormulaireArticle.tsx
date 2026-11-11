"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import type { Categorie } from "@/lib/db/schema";
import { LIMITES } from "@/lib/articles/validation";
import type { EtatFormulaire, ValeursFormulaire } from "./actions";
import { NOUVELLE } from "./constantes";

// L'éditeur ne s'affiche que dans le navigateur (immediatelyRender: false) : le charger côté
// client seulement évite d'embarquer Tiptap dans le Worker (limite de 3 Mo de l'offre gratuite).
const Editeur = dynamic(() => import("./Editeur").then((m) => m.Editeur), {
  ssr: false,
  loading: () => <p className="aide">Chargement de l’éditeur…</p>,
});

type Props = {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>;
  categories: Categorie[];
  initial: ValeursFormulaire;
};

// Formulaire d'article : champs contrôlés, pour que rien ne soit perdu en cas d'erreur
// (React 19 vide les formulaires non contrôlés après chaque envoi).
export function FormulaireArticle({ action, categories, initial }: Props) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const [v, setV] = useState<ValeursFormulaire>(initial);
  const erreurs = etat.erreurs ?? {};
  const champ = (cle: keyof ValeursFormulaire) => (e: { target: { value: string } }) =>
    setV((ancien) => ({ ...ancien, [cle]: e.target.value }));

  return (
    <form action={envoyer} className="formulaire" noValidate>
      {erreurs.general && <p role="alert" className="message-erreur">{erreurs.general}</p>}

      <div className="champ">
        <label htmlFor="titre">Titre</label>
        <input id="titre" name="titre" value={v.titre} onChange={champ("titre")} maxLength={LIMITES.titre + 50}
          aria-invalid={!!erreurs.titre} aria-describedby="titre-aide titre-erreur" autoComplete="off" />
        <p id="titre-aide" className="aide">{[...v.titre].length} / {LIMITES.titre} caractères</p>
        {erreurs.titre && <p id="titre-erreur" className="erreur" role="alert">{erreurs.titre}</p>}
      </div>

      <div className="champ">
        <label htmlFor="categorieId">Catégorie</label>
        <select id="categorieId" name="categorieId" value={v.categorieId} onChange={champ("categorieId")}
          aria-invalid={!!erreurs.categorie} aria-describedby="categorie-erreur">
          <option value="">— Choisir —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
          <option value={NOUVELLE}>+ Nouvelle catégorie…</option>
        </select>
        {v.categorieId === NOUVELLE && (
          <>
            <label htmlFor="nouvelleCategorie" className="sous-label">Nom de la nouvelle catégorie</label>
            <input id="nouvelleCategorie" name="nouvelleCategorie" value={v.nouvelleCategorie}
              onChange={champ("nouvelleCategorie")} maxLength={LIMITES.categorie + 20} autoComplete="off" />
          </>
        )}
        {erreurs.categorie && <p id="categorie-erreur" className="erreur" role="alert">{erreurs.categorie}</p>}
      </div>

      <div className="champ">
        <label htmlFor="resume">Résumé</label>
        <textarea id="resume" name="resume" rows={2} value={v.resume} onChange={champ("resume")}
          aria-invalid={!!erreurs.resume} aria-describedby="resume-aide resume-erreur" />
        <p id="resume-aide" className="aide">
          Affiché sous le titre dans Google. {[...v.resume].length} / {LIMITES.resume} caractères
        </p>
        {erreurs.resume && <p id="resume-erreur" className="erreur" role="alert">{erreurs.resume}</p>}
      </div>

      <div className="champ">
        <span id="contenu-etiquette" className="etiquette-champ">Contenu</span>
        <Editeur contenuInitial={initial.contenu} idEtiquette="contenu-etiquette"
          onChange={(json) => setV((ancien) => ({ ...ancien, contenu: json }))} />
        <input type="hidden" name="contenu" value={v.contenu} />
        {erreurs.contenu && <p className="erreur" role="alert">{erreurs.contenu}</p>}
      </div>

      <div className="actions-formulaire">
        <button type="submit" name="intention" value="publier" className="bouton" disabled={enCours}>
          Publier
        </button>
        <button type="submit" name="intention" value="brouillon" className="bouton-secondaire" disabled={enCours}>
          Enregistrer le brouillon
        </button>
        {enCours && <span role="status">Enregistrement…</span>}
      </div>
    </form>
  );
}
