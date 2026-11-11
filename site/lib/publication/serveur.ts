import { env } from "@/lib/cloudflare";
import {
  demanderPublication,
  lireConfigPublication,
  lireDernierePublication,
  type ConfigPublication,
  type EtatPublication,
} from "./declencher";

// Publication du site public depuis l'administration (D-21) : lecture de la configuration du
// Worker, demande à GitHub, état de la dernière publication. Appelé après exigerSession().

/** Issue d'une demande, reprise dans l'adresse de retour (`?site=…`) pour le message affiché. */
export type IssuePublication = "demandee" | "echec" | "locale";

async function config(): Promise<ConfigPublication | null | "invalide"> {
  try {
    return lireConfigPublication((await env()) as unknown as Record<string, unknown>);
  } catch (erreur) {
    console.error("[publication] configuration invalide :", erreur instanceof Error ? erreur.message : erreur);
    return "invalide";
  }
}

/** Demande une publication. Ne lève jamais : l'enregistrement d'Océane est déjà fait. */
export async function lancerPublication(): Promise<IssuePublication> {
  const c = await config();
  if (c === null) return "locale";
  if (c === "invalide") return "echec";
  const resultat = await demanderPublication(c);
  if (!resultat.ok) console.error("[publication] demande non aboutie :", resultat.raison);
  return resultat.ok ? "demandee" : "echec";
}

export type EtatSite = { configuree: false } | { configuree: true; derniere: EtatPublication | null | "inconnu" };

/** État affiché sur /admin. */
export async function etatPublication(): Promise<EtatSite> {
  const c = await config();
  if (c === null) return { configuree: false };
  if (c === "invalide") return { configuree: true, derniere: "inconnu" };
  return { configuree: true, derniere: await lireDernierePublication(c) };
}

/** Valeur de `?site=` reconnue, ou null. */
export function lireIssue(valeur: string | string[] | undefined): IssuePublication | null {
  return valeur === "demandee" || valeur === "echec" || valeur === "locale" ? valeur : null;
}
