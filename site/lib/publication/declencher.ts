// Déclenchement de la publication du site public (specs/SPEC-publication.md, D-21).
//
// Après un enregistrement qui change le site public, l'administration demande à GitHub de lancer
// le workflow `publier` (.github/workflows/publier.yml) : copie du contenu, build, instantané,
// déploiement. Logique testée dans tests/unit/declencher.test.ts avec un faux `fetch`.

export type ConfigPublication = {
  jeton: string; // jeton GitHub à portée fine, dépôt Natur-Oce seul, Actions en écriture
  depot: string; // « propriétaire/nom »
  branche: string;
  api: string; // https://api.github.com, ou un faux GitHub local dans les tests
};

export type ResultatDemande = { ok: true } | { ok: false; raison: string };

export type EtatPublication = { etat: "en_cours" | "faite" | "echouee"; le: number };

const WORKFLOW = "publier.yml";
const DELAI_MS = 5_000;
const API_GITHUB = "https://api.github.com";
const FAUX_GITHUB_LOCAL = /^http:\/\/127\.0\.0\.1:\d{2,5}$/;

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/**
 * Configuration lue dans les variables du Worker. Sans `GITHUB_PUBLICATION_TOKEN`, la publication
 * automatique est désactivée (développement local) : renvoie null. Une valeur mal formée est une
 * erreur de configuration, signalée tout de suite.
 */
export function lireConfigPublication(variables: Record<string, unknown>): ConfigPublication | null {
  const jeton = texte(variables.GITHUB_PUBLICATION_TOKEN);
  if (!jeton) return null;

  const depot = texte(variables.GITHUB_DEPOT) || "Dylan-f1/Natur-Oce";
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(depot) || depot.includes("..")) {
    throw new Error("GITHUB_DEPOT mal formé (attendu : propriétaire/nom)");
  }
  const branche = texte(variables.GITHUB_BRANCHE) || "main";
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(branche) || branche.includes("..")) {
    throw new Error("GITHUB_BRANCHE mal formée");
  }
  const api = texte(variables.GITHUB_API_URL) || API_GITHUB;
  if (api !== API_GITHUB && !FAUX_GITHUB_LOCAL.test(api)) {
    throw new Error("GITHUB_API_URL refusée : seule l'API GitHub (ou un faux GitHub local de test) est acceptée");
  }
  return { jeton, depot, branche, api };
}

function entetes(config: ConfigPublication): HeadersInit {
  return {
    Authorization: `Bearer ${config.jeton}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "natur-oce-administration",
  };
}

/** Lance le workflow `publier` sur la branche configurée. Ne lève jamais : l'échec est renvoyé. */
export async function demanderPublication(config: ConfigPublication, f: typeof fetch = fetch): Promise<ResultatDemande> {
  try {
    const reponse = await f(`${config.api}/repos/${config.depot}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { ...entetes(config), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: config.branche }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (reponse.status === 204 || reponse.status === 200) return { ok: true };
    return { ok: false, raison: `GitHub a refusé la demande (${reponse.status})` };
  } catch {
    return { ok: false, raison: "GitHub est injoignable" };
  }
}

/**
 * État de la dernière exécution du workflow sur la branche : null s'il n'y en a jamais eu,
 * « inconnu » si GitHub ne répond pas (l'administration reste utilisable).
 */
export async function lireDernierePublication(
  config: ConfigPublication,
  f: typeof fetch = fetch,
): Promise<EtatPublication | null | "inconnu"> {
  try {
    const parametres = new URLSearchParams({ branch: config.branche, per_page: "1" });
    const reponse = await f(`${config.api}/repos/${config.depot}/actions/workflows/${WORKFLOW}/runs?${parametres}`, {
      headers: entetes(config),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!reponse.ok) return "inconnu";
    const corps = (await reponse.json()) as {
      workflow_runs?: { status?: string; conclusion?: string | null; updated_at?: string }[];
    };
    const derniere = corps.workflow_runs?.[0];
    if (!derniere) return null;
    const le = Date.parse(derniere.updated_at ?? "");
    if (Number.isNaN(le)) return "inconnu";
    if (derniere.status !== "completed") return { etat: "en_cours", le };
    return { etat: derniere.conclusion === "success" ? "faite" : "echouee", le };
  } catch {
    return "inconnu";
  }
}
