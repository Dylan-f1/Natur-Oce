import { exigerSession } from "@/lib/session";

// Accueil de l'administration. La liste des articles arrive avec T7.
export default async function Administration() {
  const session = await exigerSession(); // aussi dans la mise en page : chaque page vérifie elle-même

  return (
    <>
      <h1>Bonjour Océane</h1>
      <p data-testid="connectee">Vous êtes connectée avec {session.user.email}.</p>
      <p>La gestion des articles et des tarifs arrive bientôt ici.</p>
    </>
  );
}
