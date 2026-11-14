import "./texte-confidentialite.css";

// Politique de confidentialité (RGPD, CDC RSE-03, RSE-04, R-03), écrite d'après le code réel :
// lib/contact.ts, app/api/contact, lib/limite.ts, lib/auth. À relire si l'un d'eux change.
// Affichée dans la fenêtre du pied de page et sur la page /confidentialite (liens directs, sans JavaScript).

export const CHAPEAU_CONFIDENTIALITE =
  "Ce site recueille le moins de données possible. Voici lesquelles, pourquoi, combien de temps, et comment exercer vos droits.";

/** `titres` : niveau des intertitres (h2 sur la page, h3 dans la fenêtre, sous son titre h2). */
export function TexteConfidentialite({ titres = "h2" }: { titres?: "h2" | "h3" }) {
  const Titre = titres;
  return (
    <div className="texte-confidentialite">
      <Titre>Qui est responsable</Titre>
      <p>
        Océane Serrière, naturopathe, est responsable des données recueillies par ce site. Pour toute
        question : <a href="mailto:contact@natur-oce.fr">contact@natur-oce.fr</a>.
      </p>

      <Titre>Le formulaire de demande de séance</Titre>
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
        Vous recevez aussitôt un e-mail qui confirme la bonne réception de votre demande. Il reprend votre
        prénom et le créneau choisi, jamais votre message.
      </p>
      <p>
        L’e-mail envoyé à Océane contient un lien pour confirmer votre rendez-vous en un clic. Ce lien
        renferme votre demande (prénom, adresse, créneau), chiffrée, et cesse de fonctionner au bout de
        sept jours. Quand Océane confirme, vous recevez un second e-mail avec la date, l’heure, le lien de
        la visio et un fichier pour votre agenda.
      </p>
      <p>
        N’écrivez pas d’informations sur votre santé dans le formulaire : vous en parlerez pendant la
        séance.
      </p>

      <Titre>La protection contre les abus</Titre>
      <p>
        Pour limiter les envois automatiques, le site compte les demandes venues d’une même adresse IP
        (cinq par heure au plus). L’adresse IP n’est jamais enregistrée telle quelle : seule une empreinte
        chiffrée, impossible à retourner, est gardée, puis effacée au bout d’une heure.
      </p>

      <Titre>Cookies et mesure d’audience</Titre>
      <p>
        Aucun cookie n’est déposé quand vous visitez le site. Il n’y a ni mesure d’audience, ni publicité,
        ni bouton de réseau social qui vous suit d’une page à l’autre. Les polices de caractères sont
        servies par le site lui-même.
      </p>
      <p>
        Un seul cookie existe, réservé à l’administration : il garde Océane connectée quand elle écrit ses
        articles. Il ne concerne pas les visiteurs.
      </p>

      <Titre>Qui d’autre traite ces données</Titre>
      <ul>
        <li>
          <strong>Cloudflare</strong> héberge le site et achemine les e-mails vers la messagerie
          d’Océane.
        </li>
        <li>
          <strong>Microsoft</strong> (Outlook) fournit la messagerie où Océane reçoit vos demandes.
        </li>
        <li>
          <strong>Mailjet</strong> envoie l’e-mail de confirmation de réception, puis celui de confirmation
          du rendez-vous : il reçoit votre adresse, votre prénom, le créneau choisi et, pour la
          confirmation, le lien de la visio, seulement pour ces envois. Le suivi des ouvertures et des
          clics est désactivé.
        </li>
      </ul>
      <p>
        Cloudflare et Microsoft sont des sociétés américaines qui peuvent traiter des données hors de
        l’Union européenne ; elles adhèrent au cadre de protection des données entre l’Union européenne et
        les États-Unis. Vos données ne sont jamais vendues ni utilisées pour de la publicité.
      </p>

      <Titre>Le lien vers Instagram</Titre>
      <p>
        Le pied de page contient un simple lien vers le compte Instagram de Natur’Océ : rien n’est chargé
        depuis Instagram tant que vous ne cliquez pas. Une fois sur Instagram, c’est la politique de
        confidentialité de Meta qui s’applique.
      </p>

      <Titre>Vos droits</Titre>
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

      <p className="mise-a-jour">Mise à jour le 14 novembre 2026.</p>
    </div>
  );
}
