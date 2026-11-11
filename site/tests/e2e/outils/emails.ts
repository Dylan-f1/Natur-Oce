import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const racine = join(__dirname, "..", "..", "..");
// En local, miniflare écrit chaque e-mail simulé dans
// .wrangler/tmp/email/miniflare-<id>/email-text/<message-id>.txt (effacé à l'arrêt du serveur).
const dossier = join(racine, ".wrangler", "tmp", "email");

function fichiersTexte(): string[] {
  if (!existsSync(dossier)) return [];
  const parcourir = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? parcourir(join(d, e.name)) : [join(d, e.name)],
    );
  return parcourir(dossier).filter((f) => /[\\/]email-text[\\/].+\.txt$/.test(f));
}

/**
 * Attend le premier e-mail simulé écrit après `depuis` (ms) et renvoie son texte.
 * Échoue après `delai` ms : aucun e-mail n'est parti.
 */
export async function attendreEmail(depuis: number, delai = 8000): Promise<string> {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    const recents = fichiersTexte()
      .map((f) => ({ f, t: statSync(f).mtimeMs }))
      .filter(({ t }) => t >= depuis - 50)
      .sort((a, b) => a.t - b.t);
    if (recents.length > 0) return readFileSync(recents[0].f, "utf8");
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Aucun e-mail simulé reçu");
}

/** Nombre d'e-mails simulés écrits après `depuis` (pour vérifier qu'aucun n'est parti). */
export function emailsDepuis(depuis: number): number {
  return fichiersTexte().filter((f) => statSync(f).mtimeMs >= depuis - 50).length;
}
