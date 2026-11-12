import { eq } from "drizzle-orm";
import { db } from "./index";
import type { Place, SectionValide } from "@/lib/sections";
import { trier } from "@/lib/sections";
import { section, type Section } from "./schema";

/** Sections ajoutées, dans l'ordre de la page ; une erreur de base est remontée (administration). */
export async function lireSections(): Promise<Section[]> {
  return trier(await (await db()).select().from(section));
}

/** Pour l'accueil public : en cas d'erreur, aucune section ajoutée (l'accueil ne tombe jamais). */
export async function listerSections(): Promise<Section[]> {
  try {
    return await lireSections();
  } catch (erreur) {
    console.error("[sections] lecture D1 impossible", erreur);
    return [];
  }
}

export async function creerSection(id: string, s: SectionValide, apres: string, ordre: number, maintenant = Date.now()): Promise<void> {
  await (await db()).insert(section).values({ id, ...s, apres, ordre, modifieLe: maintenant });
}

/** Modifie le contenu d'une section ; renvoie false si elle n'existe plus. */
export async function modifierSection(id: string, s: SectionValide, maintenant = Date.now()): Promise<boolean> {
  const lignes = await (await db())
    .update(section)
    .set({ titre: s.titre, texte: s.texte, liste: s.liste, bouton: s.bouton, imageCle: s.imageCle, imageAlt: s.imageAlt, modifieLe: maintenant })
    .where(eq(section.id, id))
    .returning({ id: section.id });
  return lignes.length > 0;
}

/** Nouvelles places de toutes les sections, en une transaction D1. */
export async function placerSections(places: readonly Place[]): Promise<void> {
  if (places.length === 0) return;
  const base = await db();
  const [premiere, ...autres] = places.map((p) => base.update(section).set({ apres: p.apres, ordre: p.ordre }).where(eq(section.id, p.id)));
  await base.batch([premiere, ...autres]);
}

export async function supprimerSection(id: string): Promise<void> {
  await (await db()).delete(section).where(eq(section.id, id));
}
