import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Contrôle rapide (Next 16 : `proxy` remplace `middleware`) : sans cookie de session, on renvoie
// tout de suite vers la connexion. Ce n'est PAS la sécurité : un cookie présent peut être expiré
// ou faux, et chaque page / action vérifie la session en base (lib/session.ts, ENF-03).
export function proxy(requete: NextRequest) {
  if (requete.nextUrl.pathname.startsWith("/admin/connexion")) return NextResponse.next();
  if (!getSessionCookie(requete, { cookiePrefix: "natur-oce" })) {
    return NextResponse.redirect(new URL("/admin/connexion", requete.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:chemin*"] };
