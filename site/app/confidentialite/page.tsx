import type { Metadata } from "next";
import { EnTete } from "../_composants/EnTete";
import { PiedDePage } from "../_composants/PiedDePage";
import "./confidentialite.css";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Les données recueillies par natur-oce.fr, pourquoi, combien de temps, et vos droits (RGPD).",
  alternates: { canonical: "/confidentialite" },
};

// Politique de confidentialité (RGPD, CDC RSE-03, RSE-04, R-03). Écrite d'après le code réel :
// lib/contact.ts, app/api/contact, lib/limite.ts, lib/auth. À relire si l'un d'eux change.
// Page figée par l'instantané (D-21, lib/publication/adresses.ts).
export default function Confidentialite() {
  return (
    <>
      <EnTete />
      <main className="cadre page-texte">
        <h1 className="titre-page">Confidentialité</h1>
        <p className="chapeau-texte">
          Ce site recueille le moins de données possible. Voici lesquelles, pourquoi, combien de temps,
          et comment exercer vos droits.
        </p>

        <h2>Qui est responsable</h2>
        <p>
          Océane Serrière, naturopathe, est responsable des données recueillies par ce site. Pour toute
          question : <a href="mailto:contact@natur-oce.fr">contact@natur-oce.fr</a>.
        </p>

        <h2>Le formulaire de demande de séance</h2>
        <p>
          Il demande votre prénom, votre adresse e-mail, un message et, si vous le souhaitez, vos
          disponibilités. Ces informations servent seulement à vous répondre et à fixer une séance, à votre
          demande.
        </p>
        <p>
          Le site ne les garde pas : elles partent aussitôt par e-mail à Océane. Elle conserve vos échanges
          le temps de votre accompagnement, puis au plus trois ans après votre dernier message.
        </p>
        <p>
          N’écrivez pas d’informations sur votre santé dans le formulaire : vous en parlerez pendant la
          séance.
        </p>

        <h2>La protection contre les abus</h2>
        <p>
          Pour limiter les envois automatiques, le site compte les demandes venues d’une même adresse IP
          (cinq par heure au plus). L’adresse IP n’est jamais enregistrée telle quelle : seule une empreinte
          chiffrée, impossible à retourner, est gardée, puis effacée au bout d’une heure.
        </p>

        <h2>Cookies et mesure d’audience</h2>
        <p>
          Aucun cookie n’est déposé quand vous visitez le site. Il n’y a ni mesure d’audience, ni publicité,
          ni bouton de réseau social qui vous suit d’une page à l’autre. Les polices de caractères sont
          servies par le site lui-même.
        </p>
        <p>
          Un seul cookie existe, réservé à l’administration : il garde Océane connectée quand elle écrit ses
          articles. Il ne concerne pas les visiteurs.
        </p>

        <h2>Qui d’autre traite ces données</h2>
        <ul>
          <li>
            <strong>Cloudflare</strong> héberge le site et achemine les e-mails vers la messagerie
            d’Océane.
          </li>
          <li>
            <strong>Microsoft</strong> (Outlook) fournit la messagerie où Océane reçoit vos demandes.
          </li>
        </ul>
        <p>
          Ces deux sociétés américaines peuvent traiter des données hors de l’Union européenne ; elles
          adhèrent au cadre de protection des données entre l’Union européenne et les États-Unis. Vos
          données ne sont jamais vendues ni utilisées pour de la publicité.
        </p>

        <h2>Le lien vers Instagram</h2>
        <p>
          Le pied de page contient un simple lien vers le compte Instagram de Natur’Océ : rien n’est chargé
          depuis Instagram tant que vous ne cliquez pas. Une fois sur Instagram, c’est la politique de
          confidentialité de Meta qui s’applique.
        </p>

        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander à consulter, corriger ou effacer vos données, vous opposer à leur
          utilisation, en limiter l’usage ou en recevoir une copie. Écrivez à{" "}
          <a href="mailto:contact@natur-oce.fr">contact@natur-oce.fr</a> : la réponse vous parvient sous
          un mois.
        </p>
        <p>
          Si la réponse ne vous satisfait pas, vous pouvez saisir la CNIL sur{" "}
          <a href="https://www.cnil.fr/fr/plaintes" rel="noopener">cnil.fr</a>.
        </p>

        <p className="mise-a-jour">Mise à jour le 12 novembre 2026.</p>
      </main>
      <PiedDePage />
    </>
  );
}
