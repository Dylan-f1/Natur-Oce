import type { Section } from "@/lib/db/schema";
import { contenuSection } from "@/lib/sections";
import { OutilsSection } from "./Crayon";

// Une section ajoutée par Océane (EF-21) : même grille que « Mon approche ». Texte brut, échappé
// par React. En mode édition, ses outils (modifier, monter, descendre, supprimer).
// « Texte + photo » : la photo sous le titre, en <img> simple vers /images/<clé> : l'instantané
// la repère dans la page et la fige en fichier (D-21, D-22).

type Props = { section: Section; ancre: string; edition: boolean; premiere: boolean; derniere: boolean };

export function SectionAjoutee({ section, ancre, edition, premiere, derniere }: Props) {
  const { paragraphes, themes } = contenuSection(section);
  const idTitre = `titre-${ancre}`;
  return (
    <section id={ancre} className={`section ajoutee ajoutee-${section.modele}`} aria-labelledby={idTitre}>
      <div className="cadre grille">
        <div className="col-titre">
          <h2 id={idTitre}>{section.titre}</h2>
          {edition && <OutilsSection id={section.id} titre={section.titre} premiere={premiere} derniere={derniere} />}
          {section.modele === "texte_photo" && section.imageCle && (
            // eslint-disable-next-line @next/next/no-img-element -- fichier figé par l'instantané, pas d'optimisation Next
            <img className="photo-ajoutee" src={`/images/${section.imageCle}`} alt={section.imageAlt ?? ""} loading="lazy" decoding="async" />
          )}
        </div>
        <div className="col-corps">
          {paragraphes.map((p, i) => <p key={i}>{p}</p>)}
          {section.modele === "texte_liste" && themes.length > 0 && (
            <ul className="liste-ajoutee">
              {themes.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {section.modele === "texte_liste" && section.bouton && (
            <a className="bouton" href="#contact">Demander une séance</a>
          )}
        </div>
      </div>
    </section>
  );
}
