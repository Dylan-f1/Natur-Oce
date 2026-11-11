"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { creerAuth, origineDesEntetes } from "@/lib/auth";

/** Déconnexion : supprime la session en base et efface le cookie (plugin nextCookies). */
export async function seDeconnecter(): Promise<void> {
  const entetes = await headers();
  try {
    const auth = await creerAuth(origineDesEntetes(entetes));
    await auth.api.signOut({ headers: entetes });
  } catch (erreur) {
    // Pas de session (déjà déconnectée) : rien à faire, on renvoie quand même vers la connexion.
    console.error("[connexion] déconnexion", erreur);
  }
  redirect("/admin/connexion?deconnecte=1");
}
