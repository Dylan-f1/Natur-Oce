"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useId, useState } from "react";
import { PanneauImage } from "./PanneauImage";

// Éditeur visuel des articles (D-20), chargé uniquement dans l'administration.
// Extensions limitées à la spec : paragraphe, intertitres h2/h3, gras, italique, listes,
// citation, lien, image (T10 : envoyée au site, description obligatoire). Le HTML public n'est PAS celui de l'éditeur :
// le serveur le refabrique depuis le JSON (lib/articles/rendu.ts).

const PROTOCOLES_LIENS = ["http", "https", "mailto"];

type Props = {
  contenuInitial: string; // JSON de l'éditeur, ou "" pour un article vide
  onChange: (json: string) => void;
  idEtiquette: string;
};

function lireInitial(json: string) {
  if (!json) return "";
  try {
    return JSON.parse(json);
  } catch {
    return "";
  }
}

export function Editeur({ contenuInitial, onChange, idEtiquette }: Props) {
  const editeur = useEditor({
    immediatelyRender: false, // rendu côté client seulement (pas de décalage d'hydratation)
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: PROTOCOLES_LIENS,
          isAllowedUri: (url, { defaultValidate }) =>
            defaultValidate(url) && (/^(https?:|mailto:)/i.test(url) || /^\/(?!\/)/.test(url)),
        },
      }),
      // Images du site seulement (/images/<clé>), jamais en base64 ni venant d'ailleurs ; le rendu
      // public les filtre de nouveau (lib/articles/rendu.ts).
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: lireInitial(contenuInitial),
    editorProps: {
      attributes: {
        class: "editeur-zone",
        "aria-labelledby": idEtiquette,
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
  });

  const idPanneau = useId();
  const [panneauImage, setPanneauImage] = useState(false);

  return (
    <div className="editeur">
      {editeur && (
        <BarreOutils editeur={editeur} panneauImage={panneauImage} idPanneau={idPanneau}
          basculerImage={() => setPanneauImage((ouvert) => !ouvert)} />
      )}
      {editeur && panneauImage && <PanneauImage editeur={editeur} idPanneau={idPanneau} fermer={() => setPanneauImage(false)} />}
      <EditorContent editor={editeur} />
    </div>
  );
}

type PropsBarre = { editeur: Editor; panneauImage: boolean; idPanneau: string; basculerImage: () => void };

function BarreOutils({ editeur, panneauImage, idPanneau, basculerImage }: PropsBarre) {
  // Se met à jour quand la sélection change (bouton « actif » sous le curseur).
  const etat = useEditorState({
    editor: editeur,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      gras: e.isActive("bold"),
      italique: e.isActive("italic"),
      puces: e.isActive("bulletList"),
      numeros: e.isActive("orderedList"),
      citation: e.isActive("blockquote"),
      lien: e.isActive("link"),
    }),
  });

  const lien = () => {
    if (etat.lien) {
      editeur.chain().focus().unsetLink().run();
      return;
    }
    const adresse = window.prompt("Adresse du lien (par exemple https://www.exemple.fr) :");
    if (!adresse) return;
    editeur.chain().focus().extendMarkRange("link").setLink({ href: adresse.trim() }).run();
  };

  const bouton = (libelle: string, actif: boolean, action: () => void) => (
    <button type="button" className="editeur-bouton" aria-pressed={actif} onClick={action}>
      {libelle}
    </button>
  );

  return (
    <div className="editeur-barre" role="toolbar" aria-label="Mise en forme">
      {bouton("Intertitre", etat.h2, () => editeur.chain().focus().toggleHeading({ level: 2 }).run())}
      {bouton("Sous-titre", etat.h3, () => editeur.chain().focus().toggleHeading({ level: 3 }).run())}
      {bouton("Gras", etat.gras, () => editeur.chain().focus().toggleBold().run())}
      {bouton("Italique", etat.italique, () => editeur.chain().focus().toggleItalic().run())}
      {bouton("Liste", etat.puces, () => editeur.chain().focus().toggleBulletList().run())}
      {bouton("Liste numérotée", etat.numeros, () => editeur.chain().focus().toggleOrderedList().run())}
      {bouton("Citation", etat.citation, () => editeur.chain().focus().toggleBlockquote().run())}
      {bouton(etat.lien ? "Retirer le lien" : "Lien", etat.lien, lien)}
      <button type="button" className="editeur-bouton" aria-expanded={panneauImage} aria-controls={idPanneau} onClick={basculerImage}>
        Image
      </button>
    </div>
  );
}
