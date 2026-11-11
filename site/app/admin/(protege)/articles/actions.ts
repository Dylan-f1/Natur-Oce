"use server";

import { redirect } from "next/navigation";
import { rendreArticle, texteBrut } from "@/lib/articles/rendu";
import { validerArticle, type ErreursArticle } from "@/lib/articles/validation";
import { categorieParId, categorieParNom, creerArticle } from "@/lib/db/articles";
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

function lire(donnees: FormData, cle: string): string {
  const v = donnees.get(cle);
  return typeof v === "string" ? v : "";
}

/**
 * Enregistre un nouvel article, en brouillon ou publié (EF-09). Le HTML public est produit ici,
 * côté serveur, par le rendu en liste blanche : rien de ce que le navigateur envoie n'est publié
 * tel quel.
 */
export async function enregistrerNouvelArticle(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  await exigerSession();

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

  if (Object.keys(erreurs).length > 0) return { erreurs, valeurs }; // la saisie est rendue telle quelle

  const categorieRetenue =
    valeurs.categorieId === NOUVELLE && verdict.valeurs.categorie
      ? await categorieParNom(verdict.valeurs.categorie)
      : existante;

  let slug: string;
  try {
    slug = await creerArticle(
      {
        titre: verdict.valeurs.titre,
        resume: verdict.valeurs.resume,
        categorieId: categorieRetenue?.id ?? null,
        contenuJson: JSON.stringify(documentEditeur),
        contenuHtml: html,
      },
      publier,
    );
  } catch (erreur) {
    console.error("[articles] enregistrement impossible", erreur);
    return { erreurs: { general: "L’enregistrement a échoué. Réessayez dans un instant : votre texte est conservé." }, valeurs };
  }

  redirect(`/admin?${publier ? "publie" : "enregistre"}=${encodeURIComponent(slug)}`);
}
