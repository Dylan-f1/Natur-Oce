"use client";

import type { Editor } from "@tiptap/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { verifierFichierChoisi } from "@/lib/images";
import { ErreurImage, reduireImage } from "./reduireImage";

type Props = { editeur: Editor; fermer: () => void; idPanneau: string };

const FORMATS = "image/jpeg,image/png,image/webp,image/heic,image/heif";

// Insertion d'une photo dans l'article (specs/SPEC-images.md, EF-11) : la description est
// obligatoire (RGAA) ; la photo est réduite dans le navigateur puis envoyée au site.
export function PanneauImage({ editeur, fermer, idPanneau }: Props) {
  const id = useId();
  const champFichier = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [erreurs, setErreurs] = useState<{ fichier?: string; description?: string; envoi?: string }>({});
  const [enCours, setEnCours] = useState(false);

  async function inserer() {
    const fichier = champFichier.current?.files?.[0];
    const suivantes: typeof erreurs = {};
    if (!fichier) suivantes.fichier = "Choisissez une photo.";
    else {
      const probleme = verifierFichierChoisi(fichier);
      if (probleme) suivantes.fichier = probleme;
    }
    if (!description.trim()) suivantes.description = "Décrivez l’image : sans description, elle n’est pas insérée.";
    setErreurs(suivantes);
    if (!fichier || Object.keys(suivantes).length > 0) return;

    setEnCours(true);
    try {
      const reduite = await reduireImage(fichier);
      const reponse = await fetch("/admin/api/images", {
        method: "POST",
        headers: { "Content-Type": reduite.type },
        body: reduite,
      });
      const corps = (await reponse.json().catch(() => ({}))) as { src?: string; largeur?: number; hauteur?: number; erreur?: string };
      if (!reponse.ok || !corps.src) throw new ErreurImage(corps.erreur ?? "L’image n’a pas pu être envoyée. Réessayez.");
      editeur.chain().focus().setImage({ src: corps.src, alt: description.trim(), width: corps.largeur, height: corps.hauteur }).run();
      fermer();
    } catch (e) {
      setErreurs({ envoi: e instanceof ErreurImage ? e.message : "L’image n’a pas pu être envoyée. Vérifiez votre connexion et réessayez." });
    } finally {
      setEnCours(false);
    }
  }

  // Entrée dans un champ du panneau insère l'image au lieu d'envoyer tout l'article.
  const entree = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void inserer();
    }
    if (e.key === "Escape") fermer();
  };

  return (
    <div id={idPanneau} className="panneau-image" role="group" aria-labelledby={`${id}-titre`} onKeyDown={entree}>
      <p id={`${id}-titre`} className="panneau-titre">Ajouter une image</p>

      <div className="champ">
        <label htmlFor={`${id}-fichier`}>Photo</label>
        <input ref={champFichier} id={`${id}-fichier`} type="file" accept={FORMATS} disabled={enCours}
          aria-invalid={!!erreurs.fichier} aria-describedby={`${id}-fichier-aide ${id}-fichier-erreur`} />
        <p id={`${id}-fichier-aide`} className="aide">JPEG, PNG, WebP ou HEIC, 10 Mo au plus. Elle sera réduite avant l’envoi.</p>
        {erreurs.fichier && <p id={`${id}-fichier-erreur`} className="erreur" role="alert">{erreurs.fichier}</p>}
      </div>

      <div className="champ">
        <label htmlFor={`${id}-description`}>Texte de description de l’image</label>
        <input id={`${id}-description`} value={description} onChange={(e) => setDescription(e.target.value)} disabled={enCours}
          maxLength={200} autoComplete="off" aria-invalid={!!erreurs.description}
          aria-describedby={`${id}-description-aide ${id}-description-erreur`} />
        <p id={`${id}-description-aide`} className="aide">Ce que montre la photo, pour les personnes qui ne la voient pas.</p>
        {erreurs.description && <p id={`${id}-description-erreur`} className="erreur" role="alert">{erreurs.description}</p>}
      </div>

      {erreurs.envoi && <p className="erreur" role="alert">{erreurs.envoi}</p>}

      <div className="actions-formulaire">
        <button type="button" className="bouton" onClick={() => void inserer()} disabled={enCours}>Insérer l’image</button>
        <button type="button" className="bouton-secondaire" onClick={fermer} disabled={enCours}>Annuler</button>
        {enCours && <span role="status">Réduction et envoi de l’image…</span>}
      </div>
    </div>
  );
}
