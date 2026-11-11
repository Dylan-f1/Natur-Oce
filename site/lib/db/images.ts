import { eq } from "drizzle-orm";
import { db } from "./index";
import { image } from "./schema";

// Accès à la table `image` (specs/SPEC-images.md, D-22). Les droits sont vérifiés par l'appelant.

export type NouvelleImage = {
  cle: string;
  type: "image/webp" | "image/jpeg";
  donnees: Uint8Array;
  largeur: number;
  hauteur: number;
};

export async function enregistrerImage(nouvelle: NouvelleImage): Promise<void> {
  await (await db()).insert(image).values({
    ...nouvelle,
    donnees: Buffer.from(nouvelle.donnees.buffer, nouvelle.donnees.byteOffset, nouvelle.donnees.byteLength),
    taille: nouvelle.donnees.byteLength,
    creeLe: Date.now(),
  });
}

/** Image par sa clé (déjà validée par l'appelant), ou null. */
export async function lireImage(cle: string): Promise<{ type: string; donnees: Uint8Array<ArrayBuffer> } | null> {
  const ligne = await (await db())
    .select({ type: image.type, donnees: image.donnees })
    .from(image)
    .where(eq(image.cle, cle))
    .get();
  if (!ligne) return null;
  // D1 renvoie un BLOB sous forme de tableau de nombres (mesuré le 11/11/2026) : on le remet en octets.
  const brut: unknown = ligne.donnees;
  const donnees = Uint8Array.from(brut as ArrayLike<number>);
  return { type: ligne.type, donnees };
}
