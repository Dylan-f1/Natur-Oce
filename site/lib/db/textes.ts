import { db } from "./index";
import { CLES_TEXTES, VALEURS_DEPART, textesDepuisBase, type Textes } from "@/lib/textes";
import { texte } from "./schema";

/** Les six textes ; une erreur de base est remontée telle quelle (administration). */
export async function lireTextes(): Promise<Textes> {
  return textesDepuisBase(await (await db()).select({ cle: texte.cle, valeur: texte.valeur }).from(texte));
}

/**
 * Pour l'accueil : en cas d'erreur de base, les valeurs de départ (jamais une marque « À FOURNIR »)
 * et l'erreur journalisée. Jamais pour l'administration : des valeurs de départ prises pour les
 * vraies, puis enregistrées, écraseraient les textes d'Océane (même règle que les tarifs).
 */
export async function listerTextes(): Promise<Textes> {
  try {
    return await lireTextes();
  } catch (erreur) {
    console.error("[textes] lecture D1 impossible", erreur);
    return { ...VALEURS_DEPART };
  }
}

/** Écrit les six textes validés par `validerTextes` en une transaction D1 : tout ou rien. */
export async function remplacerTextes(textes: Textes, maintenant = Date.now()): Promise<void> {
  const base = await db();
  await base.batch([
    base.delete(texte),
    base.insert(texte).values(CLES_TEXTES.map((cle) => ({ cle, valeur: textes[cle], modifieLe: maintenant }))),
  ]);
}
