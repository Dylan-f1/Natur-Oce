"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TARIFS_MAX, type LigneSaisie } from "@/lib/tarifs";
import { enregistrerTarifs, type EtatTarifs } from "./actions";

type Props = { initial: LigneSaisie[] };

// Liste des tarifs (EF-12) : champs contrôlés, la saisie reste en place en cas d'erreur ; l'ordre
// affiché ici est celui de l'accueil. Le serveur revalide tout (lib/tarifs.ts).
export function FormulaireTarifs({ initial }: Props) {
  const [etat, envoyer, enCours] = useActionState<EtatTarifs, FormData>(enregistrerTarifs, {});
  const [lignes, setLignes] = useState<LigneSaisie[]>(initial);
  const focusApres = useRef<string | null>(null); // id d'élément à reprendre au clavier après un rendu

  useEffect(() => {
    if (focusApres.current) {
      document.getElementById(focusApres.current)?.focus();
      focusApres.current = null;
    }
  });

  const erreurs = etat.erreurs ?? {};
  const modifier = (i: number, champ: keyof LigneSaisie, valeur: string) =>
    setLignes((l) => l.map((ligne, j) => (j === i ? { ...ligne, [champ]: valeur } : ligne)));

  const deplacer = (i: number, sens: -1 | 1) => {
    const cible = i + sens;
    if (cible < 0 || cible >= lignes.length) return;
    const id = lignes[i].id;
    setLignes((l) => {
      const copie = [...l];
      [copie[i], copie[cible]] = [copie[cible], copie[i]];
      return copie;
    });
    // Le bouton reste sous le clavier ; arrivé en bout de liste, on passe à l'autre sens.
    const bout = (sens === -1 && cible === 0) || (sens === 1 && cible === lignes.length - 1);
    focusApres.current = `${id}-${bout ? (sens === -1 ? "descendre" : "monter") : sens === -1 ? "monter" : "descendre"}`;
  };

  const supprimer = (i: number) => {
    setLignes((l) => l.filter((_, j) => j !== i));
    focusApres.current = lignes[i + 1]?.id ? `${lignes[i + 1].id}-libelle` : "ajouter-tarif";
  };

  const ajouter = () => {
    const id = crypto.randomUUID();
    setLignes((l) => [...l, { id, libelle: "", duree: "", prix: "" }]);
    focusApres.current = `${id}-libelle`;
  };

  return (
    <form action={envoyer} className="formulaire formulaire-tarifs" noValidate>
      {etat.general && <p role="alert" className="message-erreur">{etat.general}</p>}

      {lignes.length === 0 ? (
        <p className="vide">Aucun tarif : l’accueil affiche «&nbsp;Tarifs sur demande&nbsp;».</p>
      ) : (
        <ol className="liste-tarifs">
          {lignes.map((l, i) => {
            const e = erreurs[i] ?? {};
            const nom = l.libelle.trim() || `tarif ${i + 1}`;
            return (
              <li key={l.id} data-testid="ligne-tarif">
                <fieldset>
                  <legend>Tarif {i + 1}</legend>
                  <div className="champs-tarif">
                    <div className="champ champ-libelle">
                      <label htmlFor={`${l.id}-libelle`}>Nom de la séance</label>
                      <input id={`${l.id}-libelle`} value={l.libelle} onChange={(ev) => modifier(i, "libelle", ev.target.value)}
                        maxLength={120} autoComplete="off" aria-invalid={!!e.libelle} aria-describedby={`${l.id}-libelle-erreur`} />
                      {e.libelle && <p id={`${l.id}-libelle-erreur`} className="erreur">{e.libelle}</p>}
                    </div>
                    <div className="champ champ-court">
                      <label htmlFor={`${l.id}-duree`}>Durée (min)</label>
                      <input id={`${l.id}-duree`} value={l.duree} onChange={(ev) => modifier(i, "duree", ev.target.value)}
                        inputMode="numeric" autoComplete="off" aria-invalid={!!e.duree} aria-describedby={`${l.id}-duree-aide ${l.id}-duree-erreur`} />
                      <p id={`${l.id}-duree-aide`} className="aide">Facultatif</p>
                      {e.duree && <p id={`${l.id}-duree-erreur`} className="erreur">{e.duree}</p>}
                    </div>
                    <div className="champ champ-court">
                      <label htmlFor={`${l.id}-prix`}>Prix (€)</label>
                      <input id={`${l.id}-prix`} value={l.prix} onChange={(ev) => modifier(i, "prix", ev.target.value)}
                        inputMode="decimal" autoComplete="off" aria-invalid={!!e.prix} aria-describedby={`${l.id}-prix-erreur`} />
                      {e.prix && <p id={`${l.id}-prix-erreur`} className="erreur">{e.prix}</p>}
                    </div>
                  </div>
                  <div className="actions-tarif">
                    <button type="button" id={`${l.id}-monter`} className="lien-action" onClick={() => deplacer(i, -1)}
                      disabled={i === 0} aria-label={`Monter « ${nom} »`}>Monter</button>
                    <button type="button" id={`${l.id}-descendre`} className="lien-action" onClick={() => deplacer(i, 1)}
                      disabled={i === lignes.length - 1} aria-label={`Descendre « ${nom} »`}>Descendre</button>
                    <button type="button" className="lien-action lien-danger" onClick={() => supprimer(i)}
                      aria-label={`Supprimer « ${nom} »`}>Supprimer</button>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      <input type="hidden" name="lignes" value={JSON.stringify(lignes)} />

      <div className="actions-formulaire">
        <button type="button" id="ajouter-tarif" className="bouton-secondaire" onClick={ajouter} disabled={lignes.length >= TARIFS_MAX}>
          Ajouter un tarif
        </button>
        <button type="submit" className="bouton" disabled={enCours}>Enregistrer les tarifs</button>
        {enCours && <span role="status">Enregistrement…</span>}
      </div>
      {lignes.length >= TARIFS_MAX && <p className="aide">{TARIFS_MAX} tarifs au plus.</p>}
    </form>
  );
}
