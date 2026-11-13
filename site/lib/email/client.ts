import { env } from "@/lib/cloudflare";
import { cleLimite, compterTentative } from "@/lib/limite";
import { lireConfigMailjet, envoyerParMailjet } from "./mailjet";
import { adresseValide, modeleAccuseReception, type DemandeSeance } from "./modeles";

// Accusé de réception au visiteur (T20, specs/SPEC-emails-client.md). Toujours « au mieux » : un
// échec (clés absentes, plafond atteint, Mailjet en panne) est journalisé, jamais remonté — la
// demande est déjà partie chez Océane.

/** Au plus 50 accusés par jour pour tout le site : protège la réputation du domaine. */
export const ACCUSES_PAR_JOUR = 50;

export type IssueAccuse = "envoye" | "desactive" | "plafond" | "adresse" | "echec";

export async function envoyerAccuse(demande: DemandeSeance): Promise<IssueAccuse> {
  try {
    if (!adresseValide(demande.email)) return "adresse";
    const config = lireConfigMailjet((await env()) as unknown as Record<string, unknown>);
    if (!config) return "desactive";

    const jour = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
    if (!(await compterTentative(await cleLimite("accuse-jour", jour), ACCUSES_PAR_JOUR, 24 * 60 * 60 * 1000))) {
      console.warn("[accusé] plafond du jour atteint : pas d'accusé");
      return "plafond";
    }

    const m = modeleAccuseReception(demande);
    const issue = await envoyerParMailjet(config, { destinataire: { email: demande.email, nom: m.nom }, sujet: m.sujet, texte: m.texte, html: m.html });
    if (issue.ok) return "envoye";
    console.error("[accusé] envoi Mailjet impossible :", issue.raison);
    return "echec";
  } catch (erreur) {
    console.error("[accusé] erreur", erreur);
    return "echec";
  }
}
