import { creerAuth, origineDesEntetes } from "@/lib/auth";

// Routes de Better Auth (/api/auth/*) : demande de lien, vérification du lien, session, déconnexion.
// L'origine vient de l'en-tête Host, comme dans les Server Actions : `request.url` est réécrit
// par `wrangler dev` (localhost) et donnerait une autre origine que celle des liens envoyés.
async function gerer(requete: Request): Promise<Response> {
  const auth = await creerAuth(origineDesEntetes(requete.headers));
  return auth.handler(requete);
}

export { gerer as GET, gerer as POST };
