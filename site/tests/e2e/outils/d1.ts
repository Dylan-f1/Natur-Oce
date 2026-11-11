import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const racine = join(__dirname, "..", "..", "..");
// wrangler lancé directement par Node : pas de shell, donc pas d'arguments concaténés (DEP0190).
// Chemin du « bin » déclaré dans node_modules/wrangler/package.json (non exporté en module).
const wrangler = join(racine, "node_modules", "wrangler", "bin", "wrangler.js");

/**
 * Exécute du SQL sur la base D1 **locale** (la même que celle de `wrangler dev`).
 * Passe par un fichier (`--file`) pour éviter les soucis de guillemets sous Windows.
 * Réservé aux tests : jamais d'option --remote ici.
 */
export function sqlLocal(sql: string): void {
  const dossier = mkdtempSync(join(tmpdir(), "natur-oce-d1-"));
  const fichier = join(dossier, "requete.sql");
  writeFileSync(fichier, sql, "utf8");
  execFileSync(process.execPath, [wrangler, "d1", "execute", "natur-oce", "--local", "--file", fichier], {
    cwd: racine,
    stdio: "pipe",
  });
}

/** Lignes renvoyées par une requête SELECT sur la base locale (SQL écrit par le test). */
export function lignesLocales<T = Record<string, unknown>>(select: string): T[] {
  const sortie = execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "natur-oce", "--local", "--json", "--command", select],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
  return JSON.parse(sortie.slice(sortie.indexOf("[")))[0].results as T[];
}

/** Nombre de lignes d'une table de la base locale (nom de table contrôlé, pas d'injection). */
export function compterLignes(table: string): number {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Nom de table refusé : ${table}`);
  const sortie = execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "natur-oce", "--local", "--json", "--command", `SELECT COUNT(*) AS n FROM ${table}`],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
  const json = JSON.parse(sortie.slice(sortie.indexOf("[")));
  return Number(json[0].results[0].n);
}
