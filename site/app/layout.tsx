import type { Metadata, Viewport } from "next";
import { Homemade_Apple, Newsreader, Young_Serif } from "next/font/google";
import "./globals.css";

// Polices de la direction « L'herbier » (docs/DESIGN.md), auto-hébergées par next/font :
// aucun appel à Google depuis le navigateur des visiteurs (RSE-03).
const youngSerif = Young_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-young-serif",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const homemadeApple = Homemade_Apple({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-homemade-apple",
  display: "swap",
});

// R-02 : le site reste non indexé tant qu'Océane n'a pas son SIRET (mentions légales).
// Passer à true à l'obtention du SIRET, en même temps que la page Mentions légales.
const INDEXABLE = false;

export const metadata: Metadata = {
  metadataBase: new URL("https://natur-oce.fr"),
  title: {
    default: "Natur'Océ · Naturopathie en visio, spécialité accompagnement sportif",
    template: "%s · Natur'Océ",
  },
  description:
    "Océane Serrière, naturopathe en visio, avec une spécialité en accompagnement sportif.",
  openGraph: { locale: "fr_FR", siteName: "Natur'Océ", type: "website" },
  robots: { index: INDEXABLE, follow: INDEXABLE },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // contenu protégé de l'encoche via env(safe-area-inset-*)
  themeColor: "#FBF5F0",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${youngSerif.variable} ${newsreader.variable} ${homemadeApple.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
