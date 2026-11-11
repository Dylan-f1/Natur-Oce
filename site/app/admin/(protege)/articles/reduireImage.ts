// Réduction d'une photo dans le navigateur avant l'envoi (specs/SPEC-images.md, EF-11, RSE-01) :
// 1600 px de large au plus, WebP 0,82, ou JPEG 0,82 si le navigateur ne sait pas produire de WebP
// (Safari). Chargé dans l'administration seulement.

import { LARGEUR_MAX, TAILLE_MAX_SERVEUR } from "@/lib/images";

export class ErreurImage extends Error {}

function versBlob(toile: HTMLCanvasElement, type: string, qualite: number): Promise<Blob | null> {
  return new Promise((resoudre) => toile.toBlob(resoudre, type, qualite));
}

export async function reduireImage(fichier: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" }); // respecte la rotation du téléphone
  } catch {
    throw new ErreurImage(
      "Votre navigateur n’arrive pas à lire cette photo (le format HEIC n’est lu que par Safari). Essayez avec une photo en JPEG.",
    );
  }

  const echelle = Math.min(1, LARGEUR_MAX / bitmap.width);
  const toile = document.createElement("canvas");
  toile.width = Math.max(1, Math.round(bitmap.width * echelle));
  toile.height = Math.max(1, Math.round(bitmap.height * echelle));
  const contexte = toile.getContext("2d");
  if (!contexte) throw new ErreurImage("Votre navigateur ne permet pas de préparer l’image.");
  contexte.drawImage(bitmap, 0, 0, toile.width, toile.height);
  bitmap.close();

  // WebP d'abord ; un navigateur qui ne sait pas en produire renvoie un PNG à la place.
  for (const [type, qualite] of [["image/webp", 0.82], ["image/jpeg", 0.82], ["image/jpeg", 0.7]] as const) {
    const blob = await versBlob(toile, type, qualite);
    if (blob && blob.type === type && blob.size <= TAILLE_MAX_SERVEUR) return blob;
  }
  throw new ErreurImage("Cette photo reste trop lourde une fois réduite. Essayez avec une autre photo.");
}
