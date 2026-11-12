"use server";

import { redirect } from "next/navigation";
import { lireTextes, remplacerTextes } from "@/lib/db/textes";
import { lancerPublication, type IssuePublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { CLES_TEXTES, ZONES, validerTextes, type ErreursTextes, type Textes, type Zone } from "@/lib/textes";

export type EtatTextes = {
  erreurs?: ErreursTextes;
  general?: string;
  textes?: Textes; // la saisie, rendue telle quelle en cas d'erreur
};

/** Enregistre les six textes de l'accueil (EF-19) : tout ou rien, puis republie le site public. */
export async function enregistrerTextes(_etat: EtatTextes, donnees: FormData): Promise<EtatTextes> {
  await exigerSession();

  const saisie: Record<string, string> = {};
  for (const cle of CLES_TEXTES) {
    const v = donnees.get(cle);
    if (typeof v !== "string" || v.length > 20_000) {
      return { general: "Les textes n’ont pas pu être lus. Rechargez la page et réessayez." };
    }
    saisie[cle] = v;
  }

  const verdict = validerTextes(saisie);
  if (!verdict.ok) {
    return { erreurs: verdict.erreurs, general: "Certains textes sont à raccourcir : rien n’a été enregistré.", textes: verdict.textes };
  }

  try {
    await remplacerTextes(verdict.textes);
  } catch (erreur) {
    console.error("[textes] enregistrement impossible", erreur);
    return { general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.", textes: verdict.textes };
  }
  redirect(`/admin/textes?enregistre=1&site=${await lancerPublication()}`);
}

export type RetourZone = { ok: true; site: IssuePublication } | { ok: false; erreurs?: ErreursTextes; general?: string };

/**
 * « Mon accueil » (EF-20) : enregistre les textes d'une seule zone. Les autres textes sont relus en
 * base et réécrits tels quels ; la validation porte sur l'ensemble, comme la page Textes.
 */
export async function enregistrerZoneTextes(zone: Zone, saisie: Partial<Record<string, string>>): Promise<RetourZone> {
  await exigerSession();
  const cles = ZONES[zone]?.cles;
  if (!cles || cles.length === 0) return { ok: false, general: "Cette zone n’a pas de texte." };

  let actuels: Textes;
  try {
    actuels = await lireTextes();
  } catch (erreur) {
    console.error("[textes] lecture impossible avant l'enregistrement d'une zone", erreur);
    return { ok: false, general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée." };
  }
  const fusion: Record<string, string> = { ...actuels };
  for (const cle of cles) {
    const v = saisie[cle];
    if (typeof v !== "string" || v.length > 20_000) return { ok: false, general: "Les textes n’ont pas pu être lus." };
    fusion[cle] = v;
  }

  const verdict = validerTextes(fusion);
  if (!verdict.ok) return { ok: false, erreurs: verdict.erreurs, general: "Certains textes sont à raccourcir : rien n’a été enregistré." };
  try {
    await remplacerTextes(verdict.textes);
  } catch (erreur) {
    console.error("[textes] enregistrement d'une zone impossible", erreur);
    return { ok: false, general: "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée." };
  }
  return { ok: true, site: await lancerPublication() };
}

