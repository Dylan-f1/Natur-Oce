import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { creerAuth, origineDesEntetes } from "@/lib/auth";

/**
 * Couche d'accès (DAL) de l'administration : **seule** vérification d'accès qui compte (ENF-03).
 * proxy.ts ne fait qu'une redirection rapide sur l'absence de cookie.
 * `cache` évite de relire la session plusieurs fois dans un même rendu.
 */
export const sessionCourante = cache(async () => {
  const entetes = await headers();
  const auth = await creerAuth(origineDesEntetes(entetes));
  return auth.api.getSession({ headers: entetes });
});

/** À appeler en tête de chaque page et de chaque Server Action d'administration. */
export async function exigerSession() {
  const session = await sessionCourante();
  if (!session) redirect("/admin/connexion");
  return session;
}
