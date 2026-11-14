import type { Metadata } from "next";
import Link from "next/link";
import { exigerSession } from "@/lib/session";
import { seDeconnecter } from "../actions";
import "../admin.css";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration Natur’Océ" },
  robots: { index: false, follow: false },
};

// Toutes les pages de ce groupe (URL inchangées : /admin, /admin/articles…) exigent une session.
// /admin/connexion est en dehors du groupe, donc accessible sans session.
export default async function MiseEnPageAdmin({ children }: LayoutProps<"/admin">) {
  const session = await exigerSession();

  return (
    <div className="admin">
      <header className="admin-entete">
        <div className="admin-cadre">
          <Link href="/admin" className="admin-marque">Administration de Natur’Océ</Link>
          <nav aria-label="Administration">
            <ul>
              <li><Link href="/admin/accueil">Mon accueil</Link></li>
              <li><Link href="/admin">Articles</Link></li>
              <li><Link href="/admin/tarifs">Tarifs</Link></li>
              <li><Link href="/admin/textes">Textes</Link></li>
              <li><Link href="/admin/reglages">Réglages</Link></li>
              <li><Link href="/" target="_blank" rel="noopener">Voir le site</Link></li>
            </ul>
          </nav>
          <form action={seDeconnecter} className="admin-session">
            <span className="admin-qui">{session.user.email}</span>
            <button type="submit" className="admin-lien">Se déconnecter</button>
          </form>
        </div>
      </header>
      <main className="admin-cadre admin-contenu">{children}</main>
    </div>
  );
}
