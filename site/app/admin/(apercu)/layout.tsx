import type { Metadata } from "next";
import Link from "next/link";
import { exigerSession } from "@/lib/session";
import "../admin.css";

export const metadata: Metadata = {
  title: { default: "Mon accueil", template: "%s · Administration Natur’Océ" },
  robots: { index: false, follow: false },
};

// « Mon accueil » (EF-20) : l'accueil en pleine largeur, comme un visiteur le voit, sous un bandeau
// d'administration. Hors du groupe (protege) pour ne pas être enfermé dans sa colonne.
export default async function MiseEnPageApercu({ children }: LayoutProps<"/admin">) {
  await exigerSession();
  return (
    <div className="apercu">
      <div className="apercu-bandeau">
        <p><strong>Vous modifiez votre accueil.</strong> Cliquez sur « Modifier » à côté d’une partie.</p>
        <nav aria-label="Administration">
          <ul>
            <li><Link href="/admin">Articles</Link></li>
            <li><Link href="/admin/tarifs">Tarifs</Link></li>
            <li><Link href="/admin/textes">Textes</Link></li>
            <li><Link href="/admin/reglages">Réglages</Link></li>
            <li><Link href="/" target="_blank" rel="noopener">Voir le site</Link></li>
          </ul>
        </nav>
      </div>
      {children}
    </div>
  );
}
