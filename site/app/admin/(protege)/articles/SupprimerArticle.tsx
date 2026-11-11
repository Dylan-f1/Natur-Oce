"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  titre: string;
  supprimer: () => Promise<void>; // action serveur liée à l'article
};

function BoutonConfirmer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bouton-danger" disabled={pending}>
      {pending ? "Suppression…" : "Supprimer définitivement"}
    </button>
  );
}

// « Supprimer » avec confirmation (specs/SPEC-articles.md). Boîte de dialogue native : le reste
// de la page devient inerte, Échap ferme, et le focus revient sur « Supprimer » à la fermeture.
// Le focus s'ouvre sur « Annuler », le choix sans danger.
export function SupprimerArticle({ titre, supprimer }: Props) {
  const boite = useRef<HTMLDialogElement>(null);

  return (
    <section className="zone-suppression" aria-labelledby="suppression-titre">
      <h2 id="suppression-titre">Supprimer l’article</h2>
      <p className="aide">L’article disparaît du site et de l’administration. Pour le retirer sans le perdre, utilisez plutôt « Dépublier ».</p>
      <button type="button" className="bouton-danger-secondaire" onClick={() => boite.current?.showModal()}>
        Supprimer
      </button>

      <dialog ref={boite} role="alertdialog" aria-labelledby="confirmation-titre" aria-describedby="confirmation-texte" className="confirmation">
        <h2 id="confirmation-titre">Supprimer cet article ?</h2>
        <p id="confirmation-texte">
          « {titre} » sera supprimé définitivement. Cette action ne peut pas être annulée.
        </p>
        <form action={supprimer} className="confirmation-actions">
          <button type="button" className="bouton-secondaire" autoFocus onClick={() => boite.current?.close()}>
            Annuler
          </button>
          <BoutonConfirmer />
        </form>
      </dialog>
    </section>
  );
}
