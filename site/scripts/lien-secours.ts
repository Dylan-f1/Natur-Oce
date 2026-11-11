// Lien de connexion de secours (R-15, specs/SPEC-connexion.md) : si l'e-mail de connexion n'arrive
// pas, crée en ligne de commande un lien à usage unique, valable 10 minutes, pour Océane.
//
//   npm run lien-secours
//       base locale, adresse de .dev.vars, site local http://127.0.0.1:8790
//   npm run lien-secours -- --remote --email <adresse d'Océane> --origine https://natur-oce.fr
//       base EN LIGNE (accord de Dylan) ; adresse et origine obligatoires
//
// Le lien est affiché ici seulement : le transmettre à Océane par un canal sûr, jamais dans un
// fichier ni dans un dépôt. Seule l'adresse d'Océane (secret ADMIN_EMAIL) peut ouvrir une session :
// avec une autre adresse, la connexion est refusée au clic (lib/auth/index.ts).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DUREE_SECONDES, jetonAleatoire, ligneVerification, origineAcceptee, sqlInsertion, urlLienSecours } from "../lib/auth/lien-secours.ts";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(racine, "node_modules", "wrangler", "bin", "wrangler.js");

function valeur(args: string[], nom: string): string | undefined {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
}

/** ADMIN_EMAIL du fichier .dev.vars (local seulement). */
function adresseLocale(): string | undefined {
  const fichier = join(racine, ".dev.vars");
  if (!existsSync(fichier)) return undefined;
  return readFileSync(fichier, "utf8").match(/^ADMIN_EMAIL=(.+)$/m)?.[1]?.trim();
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const distant = args.includes("--remote");
  const email = valeur(args, "--email") ?? (distant ? undefined : adresseLocale());
  const origine = valeur(args, "--origine") ?? (distant ? undefined : "http://127.0.0.1:8790");

  if (!email) throw new Error(distant ? "--email est obligatoire avec --remote." : "Pas d'ADMIN_EMAIL dans .dev.vars : passez --email.");
  if (!origine || !origineAcceptee(origine)) {
    throw new Error("--origine doit être l'adresse du site (https://natur-oce.fr, l'adresse workers.dev ou le local), sans / final.");
  }
  if (distant && origine.startsWith("http://")) throw new Error("Avec --remote, l'origine doit être le site en ligne (https://…).");

  const jeton = jetonAleatoire();
  const ligne = await ligneVerification({ jeton, email, maintenant: Date.now(), id: crypto.randomUUID() });

  // Fichier temporaire : pas de guillemets à échapper pour le shell (Windows compris).
  const dossier = mkdtempSync(join(tmpdir(), "natur-oce-secours-"));
  const fichier = join(dossier, "lien.sql");
  try {
    writeFileSync(fichier, sqlInsertion(ligne), "utf8");
    execFileSync(process.execPath, [wrangler, "d1", "execute", "natur-oce", distant ? "--remote" : "--local", "--file", fichier], {
      cwd: racine,
      stdio: "pipe",
    });
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }

  const fin = new Date(ligne.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  console.log(`Lien de secours pour ${email.trim().toLowerCase()} (base ${distant ? "EN LIGNE" : "locale"}) :`);
  console.log("");
  console.log(urlLienSecours(origine, jeton));
  console.log("");
  console.log(`Valable ${DUREE_SECONDES / 60} minutes (jusqu'à ${fin}), une seule fois. Ne le partagez que par un canal sûr.`);
}

principal().catch((erreur: unknown) => {
  console.error(`[lien de secours] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
