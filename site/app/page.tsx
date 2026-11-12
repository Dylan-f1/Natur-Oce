import Image from "next/image";
import { connection } from "next/server";
import { listerArticlesPublies } from "@/lib/db/articles";
import { listerTarifs } from "@/lib/db/tarifs";
import { listerTextes } from "@/lib/db/textes";
import { formaterDuree, formaterPrix } from "@/lib/tarifs";
import { lignes, paragraphes, sansPointFinal } from "@/lib/textes";
import { EnTete } from "./_composants/EnTete";
import { FormulaireContact } from "./_composants/FormulaireContact";
import { PiedDePage } from "./_composants/PiedDePage";
import { PlancheArticle } from "./_composants/PlancheArticle";

// Accueil — porté tel quel depuis design/accueil.html (maquette validée le 10/11/2026).
// Six textes viennent de D1, modifiables par Océane (EF-19, lib/textes.ts) : vides, ils ne
// s'affichent pas. Les 3 derniers articles viennent aussi de D1 (EF-06).

/** Sans articles lisibles (base indisponible), l'accueil affiche « Les premiers conseils arrivent bientôt. » */
function erreurArticles(erreur: unknown) {
  console.error("[accueil] lecture des articles impossible", erreur);
  return [];
}

export default async function Accueil() {
  await connection(); // rendu à chaque visite : tarifs et articles viennent de D1 (EF-06, EF-12)
  const [tarifs, textes, articles] = await Promise.all([
    listerTarifs(),
    listerTextes(),
    listerArticlesPublies(3).catch(erreurArticles),
  ]);
  const themes = lignes(textes.themes);
  const outil = sansPointFinal(textes.outil_visio);
  const duree = sansPointFinal(textes.duree_bilan);

  return (
    <>
      <EnTete />

      <main>
        <div className="ouverture">
          <div className="feuille">
            <div className="ouverture-texte">
              <h1>La naturopathie, en visio, depuis chez vous.</h1>
              <p className="chapeau">
                J’accompagne votre hygiène de vie, avec une spécialité pour les sportifs : préparer
                l’effort, mieux récupérer.
              </p>
              <div className="actions">
                <a className="bouton" href="#contact">Demander une séance</a>
                <a className="lien-or" href="#sport">L’accompagnement sportif</a>
              </div>
            </div>
            <div className="specimen">
              <Image
                src="/oceane-provisoire.webp"
                alt="Portrait d’Océane Serrière"
                width={351}
                height={450}
                priority
              />
              <span className="scotch s1" aria-hidden="true" />
              <span className="scotch s2" aria-hidden="true" />
              <span className="note-photo">photo provisoire</span>
            </div>
            <div className="etiquette">
              <dl>
                <dt>Prénom</dt><dd>Océane</dd>
                <dt>Pratique</dt><dd>Naturopathie</dd>
                <dt>Spécialités</dt><dd>accompagnement sportif, gestion du stress</dd>
                <dt>Lieu</dt><dd>En visio</dd>
              </dl>
            </div>
          </div>
        </div>

        <section id="sport" className="sport sombre" aria-labelledby="titre-sport">
          <div className="cadre">
            <div className="sport-titre">
              <h2 id="titre-sport">Ma spécialité : les sportifs</h2>
              {paragraphes(textes.specialite).map((p, i) => <p key={i}>{p}</p>)}
              <a className="bouton clair" href="#contact">Demander une séance</a>
            </div>
            {themes.length > 0 && (
              <div className="sport-themes">
                <h3>Ce que l’on travaille ensemble</h3>
                <ul>
                  {themes.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section id="approche" className="section" aria-labelledby="titre-approche">
          <div className="cadre grille">
            <div className="col-titre"><h2 id="titre-approche">Mon approche</h2></div>
            <div className="col-corps">
              {paragraphes(textes.approche).map((p, i) => <p key={i}>{p}</p>)}
              {textes.formation && <p>{textes.formation}</p>}
            </div>
          </div>
        </section>

        <section id="seances" className="section" aria-labelledby="titre-seances">
          <div className="cadre grille">
            <div className="col-titre">
              <h2 id="titre-seances">Une séance, étape par étape</h2>
              <p>Tout se passe en visio : il vous faut une connexion et un endroit calme.</p>
            </div>
            <div className="col-corps">
              <ol className="etapes">
                <li><div><h3>Vous m’écrivez</h3><p>Par le formulaire, avec vos disponibilités.</p></div></li>
                <li>
                  <div>
                    <h3>On fixe un rendez-vous</h3>
                    <p>Je vous réponds par mail avec un lien de visio{outil ? ` ${outil}` : ""}.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>Le bilan</h3>
                    <p>
                      {duree ? `Durée ${duree}. ` : ""}On fait le point sur votre hygiène de vie et, si vous êtes
                      sportif, sur votre pratique.
                    </p>
                  </div>
                </li>
                <li><div><h3>Votre programme</h3><p>Vous recevez des conseils écrits, à suivre à votre rythme.</p></div></li>
              </ol>
              {/* Une étiquette d'herbier par séance (choix du 12/11, design/propositions.html, option A). */}
              {tarifs.length === 0 ? (
                <p className="tarifs tarifs-vide">Tarifs sur demande</p>
              ) : (
                <ul className="tarifs" aria-label="Tarifs des séances">
                  {tarifs.map((t) => (
                    <li key={t.id} className="tarif">
                      <span className="tarif-nom">{t.libelle}</span>
                      {t.dureeMinutes ? <>{" "}<span className="tarif-duree">{formaterDuree(t.dureeMinutes)}</span></> : null}{" "}
                      <span className="tarif-prix">{formaterPrix(t.prixCentimes)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="avert">
                La naturopathie ne remplace pas un avis médical : continuez vos traitements et
                consultez votre médecin.
              </p>
            </div>
          </div>
        </section>

        <section id="conseils" className="section conseils" aria-labelledby="titre-conseils">
          <div className="cadre">
            <div className="entete-section">
              <h2 id="titre-conseils">Conseils</h2>
              <a className="lien-or" href="/conseils">Tous les articles</a>
            </div>
            <div className="planches">
              {articles.map((a) => (
                <PlancheArticle key={a.slug} article={a} />
              ))}
            </div>
            <p className="sans-article">Les premiers conseils arrivent bientôt.</p>
          </div>
        </section>

        <section id="contact" className="contact" aria-labelledby="titre-contact">
          <div className="cadre grille">
            <div className="col-titre"><h2 id="titre-contact">Prendre rendez‑vous</h2></div>
            <div className="col-corps">
              <p>
                Écrivez-moi : je vous réponds par mail pour fixer une séance en visio. Inutile de
                décrire vos problèmes de santé, on en parlera ensemble.
              </p>
              <FormulaireContact />
            </div>
          </div>
        </section>
      </main>

      <PiedDePage />
    </>
  );
}
