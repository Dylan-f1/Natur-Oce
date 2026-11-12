"use client";

import { useActionState, useState } from "react";
import { CHAMPS_TEXTES, CLES_TEXTES, lignes, type CleTexte, type Textes } from "@/lib/textes";
import { enregistrerTextes, type EtatTextes } from "./actions";

type Props = { initial: Textes };

const longueur = (texte: string) => [...texte].length;

/** Compteur affiché sous le champ : caractères, ou nombre de lignes pour la liste des thèmes. */
function compteur(cle: CleTexte, valeur: string): { texte: string; trop: boolean } {
  const champ = CHAMPS_TEXTES[cle];
  if (champ.forme === "lignes") {
    const n = lignes(valeur).length;
    return { texte: `${n} / ${champ.maxLignes} lignes`, trop: n > (champ.maxLignes ?? Infinity) || lignes(valeur).some((l) => longueur(l) > champ.max) };
  }
  const n = longueur(valeur.trim());
  return { texte: `${n} / ${champ.max} caractères`, trop: n > champ.max };
}

// Textes de l'accueil (EF-19) : la saisie reste en place en cas d'erreur, le serveur revalide tout
// (lib/textes.ts). Les champs sont rangés par section de l'accueil, dans l'ordre de la page.
export function FormulaireTextes({ initial }: Props) {
  const [etat, envoyer, enCours] = useActionState<EtatTextes, FormData>(enregistrerTextes, {});
  const [textes, setTextes] = useState<Textes>(initial);
  const [repris, setRepris] = useState<EtatTextes | null>(null);

  // Après un refus, on réaffiche la saisie normalisée par le serveur (une seule fois par réponse).
  if (etat.textes && etat !== repris) {
    setRepris(etat);
    setTextes(etat.textes);
  }

  const erreurs = etat.erreurs ?? {};
  const sections = [...new Set(CLES_TEXTES.map((c) => CHAMPS_TEXTES[c].section))];

  return (
    <form action={envoyer} className="formulaire formulaire-textes" noValidate>
      {etat.general && <p role="alert" className="message-erreur">{etat.general}</p>}

      {sections.map((section) => (
        <fieldset key={section} className="section-textes">
          <legend>{section}</legend>
          {CLES_TEXTES.filter((c) => CHAMPS_TEXTES[c].section === section).map((cle) => {
            const champ = CHAMPS_TEXTES[cle];
            const c = compteur(cle, textes[cle]);
            const decrit = [`${cle}-aide`, `${cle}-compteur`, erreurs[cle] ? `${cle}-erreur` : ""].filter(Boolean).join(" ");
            const commun = {
              id: cle,
              name: cle,
              value: textes[cle],
              onChange: (ev: { target: { value: string } }) => setTextes((t) => ({ ...t, [cle]: ev.target.value })),
              "aria-invalid": !!erreurs[cle],
              "aria-describedby": decrit,
            };
            return (
              <div className="champ" key={cle}>
                <label htmlFor={cle}>{champ.libelle}</label>
                {champ.forme === "ligne" ? (
                  <input {...commun} autoComplete="off" />
                ) : (
                  <textarea {...commun} rows={champ.forme === "lignes" ? 6 : cle === "approche" ? 10 : 6} />
                )}
                <p id={`${cle}-aide`} className="aide">{champ.aide} Laissez vide pour ne rien afficher.</p>
                <p id={`${cle}-compteur`} className={c.trop ? "compteur compteur-trop" : "compteur"}>{c.texte}</p>
                {erreurs[cle] && <p id={`${cle}-erreur`} className="erreur">{erreurs[cle]}</p>}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div className="actions-formulaire">
        <button type="submit" className="bouton" disabled={enCours}>Enregistrer les textes</button>
        {enCours && <span role="status">Enregistrement…</span>}
      </div>
    </form>
  );
}
