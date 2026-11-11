import { expect, type Page } from "@playwright/test";
import { sqlLocal } from "./d1";
import { attendreEmail } from "./emails";

// Gestes de connexion communs aux tests (adresse fictive de .dev.vars).
export const OCEANE = "oceane@exemple.test";
export const MESSAGE_ENVOYE = "Un lien de connexion vient de partir. Il est valable 10 minutes.";

/** Repart de zéro : comptes, sessions, jetons, compteurs de limite. */
export function viderComptes(): void {
  sqlLocal(
    "DELETE FROM session; DELETE FROM account; DELETE FROM verification; DELETE FROM user; DELETE FROM rate_limit; DELETE FROM limite;",
  );
}

/** Remet les compteurs de limite à zéro (pour enchaîner plusieurs demandes de lien). */
export function viderLimites(): void {
  sqlLocal("DELETE FROM limite; DELETE FROM rate_limit;");
}

export async function demanderLien(page: Page, adresse: string): Promise<void> {
  await page.goto("/admin/connexion");
  await page.getByLabel("Adresse e-mail").fill(adresse);
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
}

export function extraireLien(texte: string): string {
  const lien = texte.match(/http:\/\/127\.0\.0\.1:\d+\/api\/auth\/magic-link\/verify\?\S+/)?.[0];
  if (!lien) throw new Error(`Pas de lien dans l'e-mail :\n${texte}`);
  return lien;
}

/** Connexion complète d'Océane : demande, lecture du lien simulé, clic. */
export async function seConnecter(page: Page): Promise<void> {
  viderLimites();
  const depuis = Date.now();
  await demanderLien(page, OCEANE);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(MESSAGE_ENVOYE);
  await page.goto(extraireLien(await attendreEmail(depuis)));
  await expect(page).toHaveURL(/\/admin$/);
}
