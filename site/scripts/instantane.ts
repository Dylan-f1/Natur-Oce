// Instantané des pages publiques (specs/SPEC-publication.md, D-21).
//
// Après `npx opennextjs-cloudflare build`, télécharge chaque page publique rendue par le Worker
// (sur la base D1 locale) et l'écrit en fichier HTML dans `.open-next/assets/`. En ligne,
// Cloudflare sert ces fichiers sans exécuter le Worker.
//
//   npm run instantane                         démarre wrangler dev (port 8793), fige, arrête
//   npm run instantane -- --serveur <origine>  utilise un serveur déjà lancé (tests E2E)
//   npm run instantane -- --nettoyer           retire l'instantané précédent, sans rien figer
//
// Le journal n'affiche que des adresses publiques : il est lisible par tous dans les Actions.

import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MARQUE, adressesPubliques, cheminFichier, marquerHtml, verifierHtml, type LigneInstantane } from "../lib/publication/adresses.ts";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(racine, "node_modules", "wrangler", "bin", "wrangler.js");
const assets = join(racine, ".open-next", "assets");
// Hors du dossier des assets : sinon le manifeste serait publié avec le site.
const manifeste = join(racine, ".open-next", "instantane.json");
const PORT = 8793;
const ATTENTE_MS = 120_000;

function journal(message: string): void {
  console.log(`[instantané] ${message}`);
}

/** Chemin absolu d'un fichier de l'instantané, garanti à l'intérieur du dossier des assets. */
function dansAssets(fichier: string): string {
  const absolu = resolve(assets, fichier);
  if (!absolu.startsWith(assets + sep)) throw new Error(`Fichier hors du dossier des assets : ${fichier}`);
  return absolu;
}

/** Retire les fichiers du précédent instantané (listés dans le manifeste) et les dossiers vidés. */
function nettoyer(): number {
  if (!existsSync(manifeste)) return 0;
  const fichiers = JSON.parse(readFileSync(manifeste, "utf8")) as string[];
  for (const fichier of fichiers) rmSync(dansAssets(fichier), { force: true });
  const dossiers = [...new Set(fichiers.map((f) => dirname(dansAssets(f))))]
    .filter((d) => d !== assets)
    .sort((a, b) => b.length - a.length); // les plus profonds d'abord
  for (const dossier of dossiers) {
    if (existsSync(dossier) && readdirSync(dossier).length === 0) rmdirSync(dossier);
  }
  rmSync(manifeste);
  return fichiers.length;
}

/** Articles publiés de la base locale, du plus récent au plus ancien. */
function lireLignes(): LigneInstantane[] {
  const sortie = execFileSync(
    process.execPath,
    [
      wrangler, "d1", "execute", "natur-oce", "--local", "--json", "--command",
      "SELECT a.slug AS slug, a.statut AS statut, c.slug AS categorieSlug FROM article a " +
        "LEFT JOIN categorie c ON c.id = a.categorie_id WHERE a.statut = 'publie' ORDER BY a.publie_le DESC",
    ],
    { cwd: racine, stdio: "pipe", encoding: "utf8" },
  );
  return JSON.parse(sortie.slice(sortie.indexOf("[")))[0].results as LigneInstantane[];
}

function demarrerServeur(): ChildProcess {
  return spawn(process.execPath, [wrangler, "dev", "--port", String(PORT), "--ip", "127.0.0.1"], {
    cwd: racine,
    stdio: "ignore",
    detached: process.platform !== "win32", // groupe de processus, pour arrêter aussi workerd
  });
}

function arreterServeur(serveur: ChildProcess): void {
  if (serveur.pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(serveur.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-serveur.pid, "SIGTERM");
}

/** Attend que `condition` soit vraie pour la page d'accueil du serveur. */
async function attendre(origine: string, condition: (html: string, statut: number) => boolean, quoi: string): Promise<void> {
  const fin = Date.now() + ATTENTE_MS;
  while (Date.now() < fin) {
    try {
      const reponse = await fetch(`${origine}/`, { redirect: "manual" });
      if (condition(await reponse.text(), reponse.status)) return;
    } catch {
      // serveur pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Délai dépassé : ${quoi}`);
}

async function figer(origine: string): Promise<{ fichier: string; html: string }[]> {
  const date = new Date().toISOString();
  const pages: { fichier: string; html: string }[] = [];
  for (const adresse of adressesPubliques(lireLignes())) {
    const reponse = await fetch(`${origine}${adresse}`, { redirect: "manual" });
    if (reponse.status !== 200) throw new Error(`${adresse} répond ${reponse.status} au lieu de 200`);
    if (!reponse.headers.get("content-type")?.startsWith("text/html")) throw new Error(`${adresse} n'est pas une page HTML`);
    const html = await reponse.text();
    verifierHtml(adresse, html);
    if (html.includes(`name="${MARQUE}"`)) throw new Error(`${adresse} vient déjà d'un instantané, pas du Worker`);
    const fichier = cheminFichier(adresse);
    pages.push({ fichier, html: marquerHtml(html, date) });
    journal(`${adresse} → ${fichier}`);
  }
  return pages;
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  if (!existsSync(assets)) throw new Error("Pas de dossier .open-next/assets : lancez d'abord `npx opennextjs-cloudflare build`.");

  const retires = nettoyer();
  if (retires > 0) journal(`${retires} fichier(s) de l'instantané précédent retiré(s)`);
  if (args.includes("--nettoyer")) return;

  const i = args.indexOf("--serveur");
  const externe = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0 && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(externe ?? "")) {
    throw new Error("--serveur attend une origine locale, par exemple http://127.0.0.1:8791");
  }
  const origine = externe ?? `http://127.0.0.1:${PORT}`;
  const serveur = externe ? undefined : demarrerServeur();

  let pages: { fichier: string; html: string }[];
  try {
    // Le serveur doit répondre, et plus avec un ancien instantané (il recharge les assets).
    await attendre(origine, (html, statut) => statut === 200 && !html.includes(`name="${MARQUE}"`), "le serveur ne répond pas");
    pages = await figer(origine);
  } finally {
    if (serveur) arreterServeur(serveur);
  }

  // Écriture à la fin seulement : un serveur qui surveille les assets ne recharge qu'une fois,
  // et une erreur en cours de route ne laisse pas un instantané à moitié fait.
  for (const { fichier, html } of pages) {
    const chemin = dansAssets(fichier);
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, html, "utf8");
  }
  writeFileSync(manifeste, JSON.stringify(pages.map((p) => p.fichier), null, 2), "utf8");
  journal(`${pages.length} page(s) écrite(s) dans ${relative(racine, assets)}`);
}

principal().catch((erreur: unknown) => {
  console.error(`[instantané] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  process.exitCode = 1;
});
