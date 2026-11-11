"use server";

import { redirect } from "next/navigation";
import { rendreArticle, texteBrut } from "@/lib/articles/rendu";
import { validerArticle, type ErreursArticle } from "@/lib/articles/validation";
import {
  articleParId,
  categorieParId,
  categorieParNom,
  creerArticle,
  modifierArticle,
  supprimerArticle,
  type NouvelArticle,
} from "@/lib/db/articles";
import { lancerPublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";
import { NOUVELLE } from "./constantes";

export type ValeursFormulaire = {
  titre: string;
  resume: string;
  categorieId: string; // id existant, "" (aucune) ou NOUVELLE
  nouvelleCategorie: string;
  contenu: string; // JSON de l'éditeur
};

export type EtatFormulaire = {
  erreurs?: ErreursArticle & { contenu?: string; general?: string };
  valeurs?: ValeursFormulaire;
};

const TAILLE_MAX_CONTENU = 300_000; // caractères de JSON (~ 100 pages de texte)
const ECHEC = "L’enregistrement a échoué. Réessayez dans un instant : votre texte est conservé.";

function lire(donnees: FormData, cle: string): string {
  const v = donnees.get(cle);
  return typeof v === "string" ? v : "";
}

type Preparation =
  | { ok: false; etat: EtatFormulaire }
  | { ok: true; publier: boolean; valeurs: ValeursFormulaire; article: NouvelArticle };

/**
 * Lit et valide le formulaire, puis prépare l'article à enregistrer. Le HTML public est produit
 * ici, côté serveur, par le rendu en liste blanche : rien de ce que le navigateur envoie n'est
 * publié tel quel.
 */
async function preparer(donnees: FormData): Promise<Preparation> {
  const publier = lire(donnees, "intention") === "publier";
  const valeurs: ValeursFormulaire = {
    titre: lire(donnees, "titre"),
    resume: lire(donnees, "resume"),
    categorieId: lire(donnees, "categorieId"),
    nouvelleCategorie: lire(donnees, "nouvelleCategorie"),
    contenu: lire(donnees, "contenu"),
  };

  // Catégorie : existante, nouvelle, ou aucune (brouillon seulement).
  const existante =
    valeurs.categorieId && valeurs.categorieId !== NOUVELLE ? await categorieParId(valeurs.categorieId) : null;
  const nomCategorie = valeurs.categorieId === NOUVELLE ? valeurs.nouvelleCategorie : (existante?.nom ?? "");

  const verdict = validerArticle({ titre: valeurs.titre, resume: valeurs.resume, categorie: nomCategorie }, publier);
  const erreurs: EtatFormulaire["erreurs"] = verdict.ok ? {} : { ...verdict.erreurs };

  // Contenu : JSON de l'éditeur, de taille bornée, non vide pour publier.
  let documentEditeur: unknown = null;
  if (valeurs.contenu.length > TAILLE_MAX_CONTENU) {
    erreurs.contenu = "Le contenu est trop long pour un seul article : découpez-le en deux.";
  } else {
    try {
      documentEditeur = valeurs.contenu ? JSON.parse(valeurs.contenu) : { type: "doc", content: [] };
    } catch {
      erreurs.contenu = "Le contenu n’a pas pu être lu. Rechargez la page et réessayez.";
    }
  }
  const html = rendreArticle(documentEditeur);
  if (!erreurs.contenu && publier && texteBrut(documentEditeur).length === 0) {
    erreurs.contenu = "Écrivez le contenu de l’article avant de publier.";
  }

  if (!verdict.ok || Object.keys(erreurs).length > 0) return { ok: false, etat: { erreurs, valeurs } };

  const categorieRetenue =
    valeurs.categorieId === NOUVELLE && verdict.valeurs.categorie
      ? await categorieParNom(verdict.valeurs.categorie)
      : existante;

  return {
    ok: true,
    publier,
    valeurs,
    article: {
      titre: verdict.valeurs.titre,
      resume: verdict.valeurs.resume,
      categorieId: categorieRetenue?.id ?? null,
      contenuJson: JSON.stringify(documentEditeur),
      contenuHtml: html,
    },
  };
}

/** Enregistre un nouvel article, en brouillon ou publié (EF-09). */
export async function enregistrerNouvelArticle(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  await exigerSession();
  const p = await preparer(donnees);
  if (!p.ok) return p.etat; // la saisie est rendue telle quelle

  let slug: string;
  try {
    slug = await creerArticle(p.article, p.publier);
  } catch (erreur) {
    console.error("[articles] enregistrement impossible", erreur);
    return { erreurs: { general: ECHEC }, valeurs: p.valeurs };
  }
  // Un brouillon jamais publié ne change pas le site public : pas de publication (D-21).
  const site = p.publier ? `&site=${await lancerPublication()}` : "";
  redirect(`/admin?${p.publier ? "publie" : "enregistre"}=${encodeURIComponent(slug)}${site}`);
}

/**
 * Enregistre une nouvelle version d'un article existant (EF-10). Sur un article publié,
 * « Enregistrer les modifications » le garde en ligne et « Dépublier » le repasse en brouillon,
 * avec la saisie du moment : rien n'est perdu.
 */
export async function enregistrerArticle(id: string, _etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  await exigerSession();
  const actuel = await articleParId(id);
  if (!actuel) return { erreurs: { general: "Cet article n’existe plus : il a peut-être été supprimé." } };

  const p = await preparer(donnees);
  if (!p.ok) return p.etat;

  let slug: string | null;
  try {
    slug = await modifierArticle(actuel, p.article, p.publier);
  } catch (erreur) {
    console.error("[articles] modification impossible", erreur);
    return { erreurs: { general: ECHEC }, valeurs: p.valeurs };
  }
  if (!slug) return { erreurs: { general: "Cet article n’existe plus : il a peut-être été supprimé." }, valeurs: p.valeurs };

  const etaitPublie = actuel.statut === "publie";
  const message = p.publier ? (etaitPublie ? "modifie" : "publie") : etaitPublie ? "depublie" : "enregistre";
  const site = etaitPublie || p.publier ? `&site=${await lancerPublication()}` : ""; // le site public change
  redirect(`/admin?${message}=${encodeURIComponent(slug)}${site}`);
}

/** Supprime définitivement un article, après confirmation dans la page. */
export async function supprimerArticleAction(id: string): Promise<void> {
  await exigerSession();
  const etaitPublie = (await articleParId(id))?.statut === "publie";
  try {
    await supprimerArticle(id); // déjà supprimé : même issue, l'article n'est plus là
  } catch (erreur) {
    console.error("[articles] suppression impossible", erreur);
    redirect(`/admin/articles/${encodeURIComponent(id)}?erreur=suppression`);
  }
  redirect(`/admin?supprime=1${etaitPublie ? `&site=${await lancerPublication()}` : ""}`);
}
