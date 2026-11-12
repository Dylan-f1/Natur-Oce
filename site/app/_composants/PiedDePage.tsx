// Pied de page du site public, avec l'avertissement médical (EF-15) et le lien Instagram (EF-13).
// Le logo Instagram est dessiné ici (SVG) : aucune ressource chargée depuis Instagram (RSE-03).

export const INSTAGRAM = "https://www.instagram.com/natur_oce/";

function LogoInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.35" cy="6.65" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function PiedDePage() {
  return (
    <footer>
      <div className="cadre">
        <p>
          La naturopathie ne remplace pas un avis médical. Continuez vos traitements et consultez
          votre médecin.
        </p>
        <ul>
          <li><a href="#">Mentions légales</a></li>
          <li><a href="/confidentialite">Confidentialité</a></li>
          <li>
            <a className="lien-instagram" href={INSTAGRAM} target="_blank" rel="noopener noreferrer"
              aria-label="Instagram de Natur’Océ (nouvel onglet)" title="Instagram de Natur’Océ">
              <LogoInstagram />
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
