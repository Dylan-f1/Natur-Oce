"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { OuvrirZone } from "@/app/_composants/Crayon";
import type { IssuePublication } from "@/lib/publication/serveur";
import type { LigneSaisie } from "@/lib/tarifs";
import { ZONES, type CleTexte, type ErreursTextes, type Textes, type Zone } from "@/lib/textes";
import { MESSAGES_SITE } from "../../(protege)/MessageSite";
import { FormulaireTarifs } from "../../(protege)/tarifs/FormulaireTarifs";
import { enregistrerZoneTextes } from "../../(protege)/textes/actions";
import { ChampTexte } from "../../(protege)/textes/FormulaireTextes";

type Props = { textes: Textes; tarifs: LigneSaisie[]; children: ReactNode };

// Éditeur de « Mon accueil » (EF-20) : les crayons ouvrent un panneau à droite (plein écran sur
// téléphone) avec les champs de leur zone. Les liens et boutons du site ne font rien ici : seuls
// les éléments marqués data-edition (crayons, panneau) agissent.
export function EditeurAccueil({ textes, tarifs, children }: Props) {
  const router = useRouter();
  const panneau = useRef<HTMLDialogElement>(null);
  const origine = useRef<HTMLElement | null>(null);
  const modifie = useRef(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const [ouverture, setOuverture] = useState(0); // remet le formulaire des tarifs à neuf à chaque ouverture
  const [saisie, setSaisie] = useState<Partial<Textes>>({});
  const [erreurs, setErreurs] = useState<ErreursTextes>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function ouvrir(z: Zone, depuis: HTMLElement) {
    origine.current = depuis;
    modifie.current = false;
    setZone(z);
    setOuverture((n) => n + 1);
    setSaisie(Object.fromEntries(ZONES[z].cles.map((c) => [c, textes[c]])));
    setErreurs({});
    setGeneral(null);
    setMessage(null);
    panneau.current?.showModal();
  }

  function fermer(sansDemander = false) {
    if (!sansDemander && modifie.current && !confirm("Abandonner vos modifications ?")) return;
    panneau.current?.close();
    setZone(null);
    origine.current?.focus();
  }

  function enregistre(site: IssuePublication) {
    const titre = zone ? ZONES[zone].titre : "";
    fermer(true);
    setMessage(`« ${titre} » est enregistré. ${MESSAGES_SITE[site]}`);
    router.refresh(); // la zone se met à jour sous ses yeux
  }

  async function enregistrerTextes() {
    if (!zone) return;
    setEnCours(true);
    setGeneral(null);
    try {
      const retour = await enregistrerZoneTextes(zone, saisie as Record<string, string>);
      if (retour.ok) enregistre(retour.site);
      else {
        setErreurs(retour.erreurs ?? {});
        setGeneral(retour.general ?? "L’enregistrement a échoué.");
      }
    } catch {
      setGeneral("L’enregistrement a échoué. Réessayez dans un instant : votre saisie est conservée.");
    } finally {
      setEnCours(false);
    }
  }

  // Dans l'aperçu, un clic sur un lien ou un bouton du site ne mène nulle part.
  function bloquer(ev: SyntheticEvent) {
    const cible = ev.target as Element;
    if (cible.closest("[data-edition]")) return;
    if (cible.closest("a, button, summary")) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  return (
    <OuvrirZone.Provider value={ouvrir}>
      {message && <p role="status" className="apercu-message" data-edition="">{message}</p>}
      <div className="apercu-site" onClickCapture={bloquer} onSubmitCapture={(ev) => ev.preventDefault()}>
        {children}
      </div>

      <dialog ref={panneau} className="panneau-edition" data-edition="" aria-labelledby="panneau-titre"
        onCancel={(ev) => { ev.preventDefault(); fermer(); }}
        onClick={(ev) => { if (ev.target === ev.currentTarget) fermer(); }}
        onInput={() => { modifie.current = true; }}>
        {zone && (
          <div className="panneau-contenu">
            <div className="panneau-entete">
              <h2 id="panneau-titre">{ZONES[zone].titre}</h2>
              <button type="button" className="admin-lien panneau-fermer" onClick={() => fermer()}>Fermer</button>
            </div>

            {zone === "tarifs" ? (
              <FormulaireTarifs key={ouverture} initial={tarifs} apresEnregistrement={enregistre} />
            ) : (
              <form className="formulaire" noValidate onSubmit={(ev) => { ev.preventDefault(); void enregistrerTextes(); }}>
                {general && <p role="alert" className="message-erreur">{general}</p>}
                {ZONES[zone].cles.map((cle: CleTexte) => (
                  <ChampTexte key={cle} cle={cle} valeur={saisie[cle] ?? ""} erreur={erreurs[cle]}
                    onChange={(v) => setSaisie((s) => ({ ...s, [cle]: v }))} />
                ))}
                <div className="actions-formulaire">
                  <button type="submit" className="bouton" disabled={enCours}>Enregistrer</button>
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
