// Faux Mailjet pour les tests E2E de l'accusé de réception (T20). Lancé par Playwright à côté de
// `wrangler dev`, qui reçoit MAILJET_API_URL=http://127.0.0.1:8797 : aucun appel au vrai Mailjet.
//   GET  /_faux/appels        envois reçus (autorisation et corps)
//   POST /_faux/reinitialiser vide les envois, remet la réponse par défaut
//   POST /_faux/reglages      { statut: 200 | 500 }

import { createServer } from "node:http";

const PORT = Number(process.env.FAUX_MAILJET_PORT ?? 8797);
let statut = 200;
let appels = [];

function lireCorps(requete) {
  return new Promise((resoudre) => {
    let corps = "";
    requete.on("data", (morceau) => (corps += morceau));
    requete.on("end", () => resoudre(corps));
  });
}

function json(reponse, code, valeur) {
  reponse.writeHead(code, { "Content-Type": "application/json" });
  reponse.end(JSON.stringify(valeur));
}

createServer(async (requete, reponse) => {
  const url = new URL(requete.url ?? "/", `http://127.0.0.1:${PORT}`);
  const corps = await lireCorps(requete);

  if (url.pathname === "/_faux/sante") return json(reponse, 200, { ok: true });
  if (url.pathname === "/_faux/appels") return json(reponse, 200, appels);
  if (url.pathname === "/_faux/reinitialiser" && requete.method === "POST") {
    appels = [];
    statut = 200;
    return json(reponse, 200, { ok: true });
  }
  if (url.pathname === "/_faux/reglages" && requete.method === "POST") {
    statut = JSON.parse(corps || "{}").statut ?? 200;
    return json(reponse, 200, { statut });
  }

  if (url.pathname === "/v3.1/send" && requete.method === "POST") {
    appels.push({ autorisation: requete.headers.authorization ?? null, corps: JSON.parse(corps || "{}") });
    return statut === 200
      ? json(reponse, 200, { Messages: [{ Status: "success" }] })
      : json(reponse, statut, { ErrorMessage: "Erreur simulée" });
  }

  json(reponse, 404, { message: "Not Found" });
}).listen(PORT, "127.0.0.1");
