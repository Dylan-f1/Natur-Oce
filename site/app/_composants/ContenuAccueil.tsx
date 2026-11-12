import Image from "next/image";
import type { Tarif } from "@/lib/db/schema";
import type { ArticlePublic } from "@/lib/db/articles";
import { formaterDuree, formaterPrix } from "@/lib/tarifs";
import { lignes, paragraphes, sansPointFinal, type Textes } from "@/lib/textes";
import { Crayon } from "./Crayon";
import { FormulaireContact } from "./FormulaireContact";
import { PlancheArticle } from "./PlancheArticle";

// Contenu de l'accueil — porté depuis design/accueil.html (maquette validée le 10/11/2026).
// Le même composant sert l'accueil public (app/page.tsx) et « Mon accueil » dans
// l'administration (EF-20, specs/SPEC-edition-visuelle.md), où `edition` ajoute les crayons.
// Les textes viennent de D1 (EF-19, lib/textes.ts) : vides, ils ne s'affichent pas.

type Props = { textes: Textes; tarifs: Tarif[]; articles: ArticlePublic[]; edition?: boolean };

export function ContenuAccueil({ textes, tarifs, articles, edition = false }: Props) {
  const themes = lignes(textes.themes);
  const themesStress = lignes(textes.themes_stress);
  const outil = sansPointFinal(textes.outil_visio);
  const duree = sansPointFinal(textes.duree_bilan);

  return (
    <>
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
          {edition && <Crayon zone="sport" />}
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

    {/* Même construction que la section sport, en clair et en miroir (demande de Dylan du 12/11). */}
    <section id="stress" className="sport stress" aria-labelledby="titre-stress">
      <div className="cadre">
        <div className="sport-titre">
          <h2 id="titre-stress">Ma spécialité : la gestion du stress</h2>
          {edition && <Crayon zone="stress" />}
          {paragraphes(textes.stress).map((p, i) => <p key={i}>{p}</p>)}
          <a className="bouton" href="#contact">Demander une séance</a>
        </div>
        {themesStress.length > 0 && (
          <div className="sport-themes">
            <h3>Ce que l’on travaille ensemble</h3>
            <ul>
              {themesStress.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>

    <section id="approche" className="section" aria-labelledby="titre-approche">
      <div className="cadre grille">
        <div className="col-titre">
          <h2 id="titre-approche">Mon approche</h2>
          {edition && <Crayon zone="approche" />}
        </div>
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
          {edition && <Crayon zone="seances" />}
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
          {edition && <Crayon zone="tarifs" />}
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
          <FormulaireContact edition={edition} />
        </div>
      </div>
    </section>
    </>
  );
}
