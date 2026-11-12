// Envoi d'une photo au site (specs/SPEC-images.md, D-22) : vérifiée, réduite dans le navigateur,
// puis rangée dans D1 par /admin/api/images. Sert aux articles et aux sections « Texte + photo ».

import { verifierFichierChoisi } from "@/lib/images";
import { ErreurImage, reduireImage } from "./reduireImage";

export type ImageEnvoyee = { src: string; cle: string; largeur?: number; hauteur?: number };

export async function envoyerImage(fichier: File): Promise<ImageEnvoyee> {
  const probleme = verifierFichierChoisi(fichier);
  if (probleme) throw new ErreurImage(probleme);
  const reduite = await reduireImage(fichier);
  const reponse = await fetch("/admin/api/images", { method: "POST", headers: { "Content-Type": reduite.type }, body: reduite });
  const corps = (await reponse.json().catch(() => ({}))) as { src?: string; largeur?: number; hauteur?: number; erreur?: string };
  if (!reponse.ok || !corps.src) throw new ErreurImage(corps.erreur ?? "L’image n’a pas pu être envoyée. Réessayez.");
  return { src: corps.src, cle: corps.src.replace(/^\/images\//, ""), largeur: corps.largeur, hauteur: corps.hauteur };
}

export { ErreurImage };
