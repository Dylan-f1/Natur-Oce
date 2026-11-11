import type { IssuePublication } from "@/lib/publication/serveur";

// Ce que devient le site public après un enregistrement (D-21 : il est republié en ≈ 3 min).
const MESSAGES_SITE: Record<IssuePublication, string> = {
  demandee: "Le site public sera à jour d’ici 3 minutes environ.",
  echec: "La mise à jour du site public n’a pas pu être lancée. Vos changements sont bien enregistrés : réessayez avec « Mettre à jour le site » (page Articles).",
  locale: "En local, le site public n’est pas republié.",
};

/** Message d'enregistrement, suivi de ce que devient le site public. */
export function MessageEnregistrement({ message, issue }: { message: string; issue: IssuePublication | null }) {
  return (
    <div className={`message-info${issue === "echec" ? " message-avertissement" : ""}`}>
      <p role="status">{message}</p>
      {issue && (
        <p data-testid="message-site" role={issue === "echec" ? "alert" : undefined}>{MESSAGES_SITE[issue]}</p>
      )}
    </div>
  );
}
