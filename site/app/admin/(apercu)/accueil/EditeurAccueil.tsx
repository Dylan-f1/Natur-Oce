"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { ActionsSection, OuvrirZone, type ActionsSections } from "@/app/_composants/Crayon";
import type { IssuePublication } from "@/lib/publication/serveur";
import { LIMITES_SECTION, MODELES, estModele, type ErreursSection, type ModeleT18, type SaisieSection } from "@/lib/sections";
import type { LigneSaisie } from "@/lib/tarifs";
import { ZONES, type CleTexte, type ErreursTextes, type Textes, type Zone } from "@/lib/textes";
import { MESSAGES_SITE } from "../../(protege)/MessageSite";
import { FormulaireTarifs } from "../../(protege)/tarifs/FormulaireTarifs";
import { enregistrerZoneTextes } from "../../(protege)/textes/actions";
import { ChampTexte } from "../../(protege)/textes/FormulaireTextes";
import { ajouterSection, deplacerSection, enregistrerSection, retirerSection, type RetourSection } from "./actions";

type SectionEditee = { id: string; modele: string; titre: string; texte: string; liste: string; bouton: boolean };
type Props = { textes: Textes; tarifs: LigneSaisie[]; sections: SectionEditee[]; children: ReactNode };

/** Ce que montre le panneau : une zone d'origine, une section ajoutée, ou une nouvelle section. */
type Cible =
  | { type: "zone"; zone: Zone }
  | { type: "section"; id: string; modele: ModeleT18; titre: string }
  | { type: "nouvelle"; apres: string; modele: ModeleT18 | null };

const SECTION_VIDE: SaisieSection = { titre: "", texte: "", liste: "", bouton: true };
const ECHEC = "L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.";

// Éditeur de « Mon accueil » (EF-20, EF-21) : les crayons ouvrent un panneau à droite (plein écran
// sur téléphone) avec les champs de leur zone ou de leur section. Les liens et boutons du site ne
// font rien ici : seuls les éléments marqués data-edition (crayons, outils, panneau) agissent.
export function EditeurAccueil({ textes, tarifs, sections, children }: Props) {
  const router = useRouter();
  const panneau = useRef<HTMLDialogElement>(null);
  const origine = useRef<HTMLElement | null>(null);
  const modifie = useRef(false);
  const [cible, setCible] = useState<Cible | null>(null);
  const [ouverture, setOuverture] = useState(0); // remet le formulaire des tarifs à neuf à chaque ouverture
  const [saisie, setSaisie] = useState<Partial<Textes>>({});
  const [erreurs, setErreurs] = useState<ErreursTextes>({});
  const [saisieSection, setSaisieSection] = useState<SaisieSection>(SECTION_VIDE);
  const [erreursSection, setErreursSection] = useState<ErreursSection>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function ouvrirPanneau(c: Cible, depuis: HTMLElement) {
    origine.current = depuis;
    modifie.current = false;
    setCible(c);
    setOuverture((n) => n + 1);
    setErreurs({});
    setErreursSection({});
    setGeneral(null);
    setMessage(null);
    panneau.current?.showModal();
  }

  function ouvrir(z: Zone, depuis: HTMLElement) {
    setSaisie(Object.fromEntries(ZONES[z].cles.map((c) => [c, textes[c]])));
    ouvrirPanneau({ type: "zone", zone: z }, depuis);
  }

  const actions: ActionsSections = {
    modifier(id, depuis) {
      const s = sections.find((x) => x.id === id);
      if (!s || !estModele(s.modele)) return;
      setSaisieSection({ titre: s.titre, texte: s.texte, liste: s.liste, bouton: s.bouton });
      ouvrirPanneau({ type: "section", id, modele: s.modele, titre: s.titre }, depuis);
    },
    ajouter(apres, depuis) {
      setSaisieSection(SECTION_VIDE);
      ouvrirPanneau({ type: "nouvelle", apres, modele: null }, depuis);
    },
    async deplacer(id, sens) {
      await suivre(deplacerSection(id, sens), "La section est déplacée.");
    },
    async supprimer(id, titre) {
      if (!confirm(`Supprimer la section « ${titre} » ? Elle disparaîtra de votre accueil.`)) return;
      await suivre(retirerSection(id), `« ${titre} » est supprimée.`);
    },
  };

  /** Déplacement ou suppression : pas de panneau, un message, puis la page se met à jour. */
  async function suivre(promesse: Promise<RetourSection>, reussite: string) {
    try {
      const retour = await promesse;
      setMessage(retour.ok ? `${reussite} ${MESSAGES_SITE[retour.site]}` : (retour.general ?? ECHEC));
      if (retour.ok) router.refresh();
    } catch {
      setMessage("L’action a échoué. Réessayez dans un instant.");
    }
  }

  function fermer(sansDemander = false) {
    if (!sansDemander && modifie.current && !confirm("Abandonner vos modifications ?")) return;
    panneau.current?.close();
    setCible(null);
    origine.current?.focus();
  }

  function enregistre(site: IssuePublication, quoi: string) {
    fermer(true);
    setMessage(`${quoi} ${MESSAGES_SITE[site]}`);
    router.refresh(); // la zone se met à jour sous ses yeux
  }

  async function enregistrer() {
    if (!cible || cible.type === "nouvelle" && !cible.modele) return;
    setEnCours(true);
    setGeneral(null);
    try {
      if (cible.type === "zone") {
        const retour = await enregistrerZoneTextes(cible.zone, saisie as Record<string, string>);
        if (retour.ok) return enregistre(retour.site, `« ${ZONES[cible.zone].titre} » est enregistré.`);
        setErreurs(retour.erreurs ?? {});
        setGeneral(retour.general ?? ECHEC);
      } else {
        const retour = cible.type === "section"
          ? await enregistrerSection(cible.id, saisieSection)
          : await ajouterSection(cible.apres, cible.modele!, saisieSection);
        if (retour.ok) return enregistre(retour.site, cible.type === "section" ? `« ${saisieSection.titre.trim()} » est enregistrée.` : "La section est ajoutée.");
        setErreursSection(retour.erreurs ?? {});
        setGeneral(retour.general ?? ECHEC);
      }
    } catch {
      setGeneral(ECHEC);
    } finally {
      setEnCours(false);
    }
  }

  // Dans l'aperçu, un clic sur un lien ou un bouton du site ne mène nulle part.
  function bloquer(ev: SyntheticEvent) {
    const element = ev.target as Element;
    if (element.closest("[data-edition]")) return;
    if (element.closest("a, button, summary")) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  const titrePanneau = !cible ? "" : cible.type === "zone" ? ZONES[cible.zone].titre : cible.type === "section" ? cible.titre : "Nouvelle section";
  const modele = cible?.type === "section" ? cible.modele : cible?.type === "nouvelle" ? cible.modele : null;
  const champSection = (nom: "titre" | "texte" | "liste") => ({
    id: `section-${nom}`,
    value: saisieSection[nom],
    onChange: (ev: { target: { value: string } }) => setSaisieSection((s) => ({ ...s, [nom]: ev.target.value })),
    "aria-invalid": !!erreursSection[nom],
    "aria-describedby": erreursSection[nom] ? `section-${nom}-erreur` : undefined,
  });
  const erreurSection = (nom: "titre" | "texte" | "liste") =>
    erreursSection[nom] && <p id={`section-${nom}-erreur`} className="erreur">{erreursSection[nom]}</p>;

  return (
    <OuvrirZone.Provider value={ouvrir}>
      <ActionsSection.Provider value={actions}>
        {message && <p role="status" className="apercu-message" data-edition="">{message}</p>}
        <div className="apercu-site" onClickCapture={bloquer} onSubmitCapture={(ev) => ev.preventDefault()}>
          {children}
        </div>
      </ActionsSection.Provider>

      <dialog ref={panneau} className="panneau-edition" data-edition="" aria-labelledby="panneau-titre"
        onCancel={(ev) => { ev.preventDefault(); fermer(); }}
        onClick={(ev) => { if (ev.target === ev.currentTarget) fermer(); }}
        onInput={() => { modifie.current = true; }}>
        {cible && (
          <div className="panneau-contenu">
            <div className="panneau-entete">
              <h2 id="panneau-titre">{titrePanneau}</h2>
              <button type="button" className="admin-lien panneau-fermer" onClick={() => fermer()}>Fermer</button>
            </div>

            {cible.type === "zone" && cible.zone === "tarifs" ? (
              <FormulaireTarifs key={ouverture} initial={tarifs}
                apresEnregistrement={(site) => enregistre(site, "« Les tarifs » sont enregistrés.")} />
            ) : cible.type === "nouvelle" && !cible.modele ? (
              <div className="choix-modele" role="group" aria-labelledby="choix-modele-titre">
                <p id="choix-modele-titre">Quel genre de section ?</p>
                {(Object.keys(MODELES) as ModeleT18[]).map((m) => (
                  <button key={m} type="button" className="carte-modele" onClick={() => setCible({ ...cible, modele: m })}>
                    <strong>{MODELES[m].libelle}</strong>
                    <span>{MODELES[m].aide}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form className="formulaire" noValidate onSubmit={(ev) => { ev.preventDefault(); void enregistrer(); }}>
                {general && <p role="alert" className="message-erreur">{general}</p>}
                {cible.type === "zone" ? (
                  ZONES[cible.zone].cles.map((cle: CleTexte) => (
                    <ChampTexte key={cle} cle={cle} valeur={saisie[cle] ?? ""} erreur={erreurs[cle]}
                      onChange={(v) => setSaisie((s) => ({ ...s, [cle]: v }))} />
                  ))
                ) : (
                  <>
                    {cible.type === "nouvelle" && <p className="aide">Modèle : {MODELES[cible.modele!].libelle}.</p>}
                    <div className="champ">
                      <label htmlFor="section-titre">Titre de la section</label>
                      <input {...champSection("titre")} maxLength={LIMITES_SECTION.titre + 40} autoComplete="off" />
                      {erreurSection("titre")}
                    </div>
                    <div className="champ">
                      <label htmlFor="section-texte">Texte{modele === "texte_liste" ? " (facultatif)" : ""}</label>
                      <textarea {...champSection("texte")} rows={modele === "texte" ? 10 : 5} />
                      <p className="aide">Laissez une ligne vide entre deux paragraphes.</p>
                      {erreurSection("texte")}
                    </div>
                    {modele === "texte_liste" && (
                      <>
                        <div className="champ">
                          <label htmlFor="section-liste">Liste des thèmes</label>
                          <textarea {...champSection("liste")} rows={6} />
                          <p className="aide">Un thème par ligne, {LIMITES_SECTION.lignes} au plus.</p>
                          {erreurSection("liste")}
                        </div>
                        <label className="case">
                          <input type="checkbox" checked={saisieSection.bouton}
                            onChange={(ev) => setSaisieSection((s) => ({ ...s, bouton: ev.target.checked }))} />
                          Ajouter le bouton « Demander une séance »
                        </label>
                      </>
                    )}
                  </>
                )}
                <div className="actions-formulaire">
                  <button type="submit" className="bouton" disabled={enCours}>
                    {cible.type === "nouvelle" ? "Ajouter la section" : "Enregistrer"}
                  </button>
                  <button type="button" className="bouton-secondaire" onClick={() => fermer()}>Annuler</button>
                  {enCours && <span role="status">Enregistrement…</span>}
                </div>
              </form>
            )}
          </div>
        )}
      </dialog>
    </OuvrirZone.Provider>
  );
}
