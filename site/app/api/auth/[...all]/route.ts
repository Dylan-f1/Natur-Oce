import { creerAuth, origineDesEntetes } from "@/lib/auth";

// Routes de Better Auth (/api/auth/*) : vérification du lien, session, déconnexion.
// L'origine vient de l'en-tête Host, comme dans les Server Actions : `request.url` est réécrit
// par `wrangler dev` (localhost) et donnerait une autre origine que celle des liens envoyés.

// Demandes de lien : uniquement par la page /admin/connexion (Server Action, qui appelle
// Better Auth sans passer par HTTP). Appelée à la main, la route HTTP enregistrerait l'adresse
// saisie, quelle qu'elle soit, et contournerait le tri et la limite de la page : elle est fermée.
const ROUTES_FERMEES = new Set(["/api/auth/sign-in/magic-link"]);

async function gerer(requete: Request): Promise<Response> {
  if (ROUTES_FERMEES.has(new URL(requete.url).pathname)) {
    return new Response("Introuvable", { status: 404 });
  }
  const auth = await creerAuth(origineDesEntetes(requete.headers));
  return auth.handler(requete);
}

export { gerer as GET, gerer as POST };
