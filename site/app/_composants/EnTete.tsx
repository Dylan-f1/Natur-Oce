import Image from "next/image";
import Link from "next/link";

// En-tête du site public, commun à l'accueil et aux conseils. Liens absolus (/#…) : ils
// fonctionnent depuis n'importe quelle page.
export function EnTete() {
  return (
    <header className="cadre entete">
      <Link className="marque" href="/">
        <Image
          src="/logo-natur-oce-144.webp"
          alt="Natur’Océ, naturopathie et accompagnement sportif"
          width={72}
          height={72}
          priority
        />
        <span>Natur’Océ</span>
      </Link>
      <nav aria-label="Navigation principale">
        <ul>
          <li><Link href="/#approche">Approche</Link></li>
          <li><Link href="/#sport">Sportifs</Link></li>
          <li><Link href="/#seances">Séances</Link></li>
          <li><Link href="/conseils">Conseils</Link></li>
        </ul>
      </nav>
      <Link className="bouton" href="/#contact">Demander une séance</Link>
    </header>
  );
}
