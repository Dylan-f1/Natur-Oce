"use server";

import { redirect } from "next/navigation";
import { lancerPublication } from "@/lib/publication/serveur";
import { exigerSession } from "@/lib/session";

/** « Mettre à jour le site » : relance la publication à la main (après un échec, par exemple). */
export async function relancerPublication(): Promise<void> {
  await exigerSession();
  redirect(`/admin?site=${await lancerPublication()}`);
}
