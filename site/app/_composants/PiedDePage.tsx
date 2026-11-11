// Pied de page du site public, avec l'avertissement médical (EF-15).
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
          <li><a href="#">Confidentialité</a></li>
          <li><a href="#">Instagram</a></li>
        </ul>
      </div>
    </footer>
  );
}
