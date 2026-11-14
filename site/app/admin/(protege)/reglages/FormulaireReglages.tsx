"use client";

import { useActionState } from "react";
import { DUREE, LIEN_VISIO_MAX } from "@/lib/reglages";
import { enregistrerReglagesAction, type EtatReglages } from "./actions";

type Props = { initial: { lienVisio: string; dureeMinutes: string } };

// Réglages d'Océane (T21) : lien de visio permanent et durée d'une séance. Le serveur revalide tout.
export function FormulaireReglages({ initial }: Props) {
  const [etat, envoyer, enCours] = useActionState<EtatReglages, FormData>(enregistrerReglagesAction, {});
  const valeurs = etat.valeurs ?? initial;
  const erreurs = etat.erreurs ?? {};

  return (
    <form action={envoyer} className="formulaire" noValidate key={etat.valeurs ? JSON.stringify(etat.valeurs) : "initial"}>
      {etat.general && <p role="alert" className="message-erreur">{etat.general}</p>}
      {etat.enregistre && <p role="status" className="message-info">Les réglages sont enregistrés.</p>}

      <div className="champ">
        <label htmlFor="lienVisio">Votre lien de visio</label>
        <input id="lienVisio" name="lienVisio" defaultValue={valeurs.lienVisio} maxLength={LIEN_VISIO_MAX + 100}
          autoComplete="off" inputMode="url" placeholder="https://meet.google.com/…"
          aria-invalid={!!erreurs.lienVisio} aria-describedby={`lienVisio-aide${erreurs.lienVisio ? " lienVisio-erreur" : ""}`} />
        <p id="lienVisio-aide" className="aide">
          L’adresse permanente de votre salle (Google Meet, Zoom, Teams…). Elle est envoyée au client dans la confirmation du
          rendez-vous. Vide, la confirmation en un clic ne peut pas partir.
        </p>
        {erreurs.lienVisio && <p id="lienVisio-erreur" className="erreur">{erreurs.lienVisio}</p>}
      </div>

      <div className="champ">
        <label htmlFor="dureeMinutes">Durée d’une séance (minutes)</label>
        <input id="dureeMinutes" name="dureeMinutes" inputMode="numeric" defaultValue={valeurs.dureeMinutes} autoComplete="off"
          aria-invalid={!!erreurs.dureeMinutes} aria-describedby={`dureeMinutes-aide${erreurs.dureeMinutes ? " dureeMinutes-erreur" : ""}`} />
        <p id="dureeMinutes-aide" className="aide">Entre {DUREE.min} et {DUREE.max}. Écrite dans la confirmation et dans le fichier d’agenda.</p>
        {erreurs.dureeMinutes && <p id="dureeMinutes-erreur" className="erreur">{erreurs.dureeMinutes}</p>}
      </div>

      <div className="actions-formulaire">
        <button type="submit" className="bouton" disabled={enCours}>Enregistrer les réglages</button>
        {enCours && <span role="status">Enregistrement…</span>}
      </div>
    </form>
  );
}
