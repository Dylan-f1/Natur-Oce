import type { Metadata } from "next";
import { demanderLien } from "./actions";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

// Messages de la page (specs/SPEC-connexion.md). `error=INVALID_TOKEN` vient de Better Auth
// quand le lien est expiré ou déjà utilisé.
const MESSAGES: Record<string, { texte: string; ton: "info" | "erreur" }> = {
  envoye: { texte: "Un lien de connexion vient de partir. Il est valable 10 minutes.", ton: "info" },
  deconnecte: { texte: "Vous êtes déconnectée.", ton: "info" },
  INVALID_TOKEN: { texte: "Ce lien a expiré. Demandez-en un nouveau.", ton: "erreur" },
  trop: { texte: "Trop de demandes. Réessayez dans 15 minutes.", ton: "erreur" },
  adresse: { texte: "Saisissez une adresse e-mail valide, par exemple prenom@exemple.fr.", ton: "erreur" },
  technique: { texte: "La demande n’a pas abouti. Réessayez dans un instant.", ton: "erreur" },
};

export default async function PageConnexion({ searchParams }: PageProps<"/admin/connexion">) {
  const p = await searchParams;
  const cle = p.envoye ? "envoye" : p.deconnecte ? "deconnecte" : String(p.error ?? p.erreur ?? "");
  const message = MESSAGES[cle];

  return (
    <main className="cadre" style={{ maxWidth: "34rem", paddingBlock: "clamp(3rem, 10vh, 6rem)" }}>
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)", marginBottom: "1rem" }}>Connexion</h1>
      <p>Saisissez votre adresse : vous recevrez un lien pour accéder à l’administration du site.</p>

      {message && (
        <p role={message.ton === "erreur" ? "alert" : "status"} className={`message-${message.ton}`}>
          {message.texte}
        </p>
      )}

      <form action={demanderLien} style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          style={{ fontSize: "1rem", padding: "0.8rem 0.9rem", border: "1px solid var(--filet)", background: "#FFFDF8" }}
        />
        <button className="bouton" type="submit" style={{ justifySelf: "start", border: 0, cursor: "pointer" }}>
          Recevoir mon lien
        </button>
      </form>
    </main>
  );
}
