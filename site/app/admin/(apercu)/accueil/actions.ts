"use server";

import { creerSection, lireSections, modifierSection, placerSections, supprimerSection } from "@/lib/db/sections";
import { lancerPublication, type IssuePublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { SECTIONS_MAX, deplacer, estEmplacement, estModele, validerSection, type ErreursSection } from "@/lib/sections";

// Sections ajoutées depuis « Mon accueil » (EF-21) : chaque action revérifie la session et la
// saisie, écrit, puis demande une publication du site public.

export type RetourSection = { ok: true; site: IssuePublication } | { ok: false; erreurs?: ErreursSection; general?: string };

const ECHEC = "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.";

export async function ajouterSection(apres: string, modele: string, saisie: Record<string, unknown>): Promise<RetourSection> {
  await exigerSession();
  if (!estEmplacement(apres) || !estModele(modele)) return { ok: false, general: "Cette section ne peut pas être ajoutée ici." };
  const verdict = validerSection(modele, saisie);
  if (!verdict.ok) return { ok: false, erreurs: verdict.erreurs, general: "Certains champs sont à corriger : rien n’a été enregistré." };
  try {
    const sections = await lireSections();
    if (sections.length >= SECTIONS_MAX) return { ok: false, general: `${SECTIONS_MAX} sections ajoutées au plus : supprimez-en une d’abord.` };
    const ordre = sections.filter((s) => s.apres === apres).length;
    await creerSection(crypto.randomUUID(), verdict.section, apres, ordre);
  } catch (erreur) {
    console.error("[sections] ajout impossible", erreur);
    return { ok: false, general: ECHEC };
  }
  return { ok: true, site: await lancerPublication() };
}

export async function enregistrerSection(id: string, saisie: Record<string, unknown>): Promise<RetourSection> {
  await exigerSession();
  try {
    const actuelle = (await lireSections()).find((s) => s.id === id);
    if (!actuelle || !estModele(actuelle.modele)) return { ok: false, general: "Cette section n’existe plus. Rechargez la page." };
    const verdict = validerSection(actuelle.modele, saisie);
    if (!verdict.ok) return { ok: false, erreurs: verdict.erreurs, general: "Certains champs sont à corriger : rien n’a été enregistré." };
    if (!(await modifierSection(id, verdict.section))) return { ok: false, general: "Cette section n’existe plus. Rechargez la page." };
  } catch (erreur) {
    console.error("[sections] modification impossible", erreur);
    return { ok: false, general: ECHEC };
  }
  return { ok: true, site: await lancerPublication() };
}

export async function deplacerSection(id: string, sens: number): Promise<RetourSection> {
  await exigerSession();
  if (sens !== -1 && sens !== 1) return { ok: false, general: "Déplacement inconnu." };
  try {
    const places = deplacer(await lireSections(), id, sens);
    if (!places) return { ok: false, general: "Cette section ne peut pas aller plus loin." };
    await placerSections(places);
  } catch (erreur) {
    console.error("[sections] déplacement impossible", erreur);
    return { ok: false, general: "Le déplacement a échoué. Réessayez dans un instant." };
  }
  return { ok: true, site: await lancerPublication() };
}

export async function retirerSection(id: string): Promise<RetourSection> {
  await exigerSession();
  try {
    await supprimerSection(id);
  } catch (erreur) {
    console.error("[sections] suppression impossible", erreur);
    return { ok: false, general: "La suppression a échoué. Réessayez dans un instant." };
  }
  return { ok: true, site: await lancerPublication() };
}
