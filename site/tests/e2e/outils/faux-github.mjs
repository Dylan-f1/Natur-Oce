// Faux GitHub pour les tests E2E de la publication (P3, D-21). Lancé par Playwright à côté de
// `wrangler dev`, qui reçoit GITHUB_API_URL=http://127.0.0.1:8796 : aucun appel au vrai GitHub.
//
// Imite les deux routes utilisées par lib/publication/declencher.ts, et expose de quoi piloter
// et relire les échanges depuis les tests :
//   GET  /_faux/appels        demandes de publication reçues
//   POST /_faux/reinitialiser vide les appels, remet les réponses par défaut
//   POST /_faux/reglages      { lancement: 204 | 500, derniere: {status, conclusion, updated_at} | null }

import { createServer } from "node:http";

const PORT = Number(process.env.FAUX_GITHUB_PORT ?? 8796);

const parDefaut = () => ({
  lancement: 204,
  derniere: { status: "completed", conclusion: "success", updated_at: "2026-11-11T09:42:00Z" },
});
let reglages = parDefaut();
let appels = [];

function lireCorps(requete) {
  return new Promise((resoudre) => {
    let corps = "";
    requete.on("data", (morceau) => (corps += morceau));
    requete.on("end", () => resoudre(corps));
  });
}

function json(reponse, statut, valeur) {
  reponse.writeHead(statut, { "Content-Type": "application/json" });
  reponse.end(valeur === undefined ? "" : JSON.stringify(valeur));
}

createServer(async (requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://127.0.0.1:${PORT}`);
  const corps = await lireCorps(requete);

  if (url.pathname === "/_faux/sante") return json(reponse, 200, { ok: true });
  if (url.pathname === "/_faux/appels") return json(reponse, 200, appels);
  if (url.pathname === "/_faux/reinitialiser" && requete.method === "POST") {
    appels = [];
    reglages = parDefaut();
    return json(reponse, 200, { ok: true });
  }
  if (url.pathname === "/_faux/reglages" && requete.method === "POST") {
    reglages = { ...reglages, ...JSON.parse(corps || "{}") };
    return json(reponse, 200, reglages);
  }

  const lancement = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/publier\.yml\/dispatches$/);
  if (lancement && requete.method === "POST") {
    appels.push({
      depot: lancement[1],
      corps: JSON.parse(corps || "{}"),
      autorisation: requete.headers.authorization ?? null,
      agent: requete.headers["user-agent"] ?? null,
    });
    return reglages.lancement === 204 ? json(reponse, 204) : json(reponse, reglages.lancement, { message: "Erreur simulée" });
  }

  const executions = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/publier\.yml\/runs$/);
  if (executions && requete.method === "GET") {
    return json(reponse, 200, { workflow_runs: reglages.derniere ? [reglages.derniere] : [] });
  }

  json(reponse, 404, { message: "Not Found" });
}).listen(PORT, "127.0.0.1");
