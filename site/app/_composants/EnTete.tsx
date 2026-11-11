import Image from "next/image";

// En-tête du site public, commun à l'accueil et aux conseils. Liens absolus (/#…) : ils
// fonctionnent depuis n'importe quelle page. De simples <a>, pas next/link : les pages publiques
// sont des fichiers statiques (D-21, specs/SPEC-publication.md).
export function EnTete() {
  return (
    <header className="cadre entete">
      <a className="marque" href="/">
        <Image
          src="/logo-natur-oce-144.webp"
          alt="Natur’Océ, naturopathie et accompagnement sportif"
          width={72}
          height={72}
          priority
        />
        <span>Natur’Océ</span>
      </a>
      <nav aria-label="Navigation principale">
        <ul>
          <li><a href="/#approche">Approche</a></li>
          <li><a href="/#sport">Sportifs</a></li>
          <li><a href="/#seances">Séances</a></li>
          <li><a href="/conseils">Conseils</a></li>
        </ul>
      </nav>
      <a className="bouton" href="/#contact">Demander une séance</a>
    </header>
  );
}
