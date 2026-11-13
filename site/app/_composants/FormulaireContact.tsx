"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAMP_PIEGE, CRENEAU, LIMITES_CONTACT, MOTIF_EMAIL, bornesJour, validerDemande, type ChampsContact, type ErreursContact } from "@/lib/contact";
import "./formulaire-contact.css";

// Demande de séance (specs/SPEC-contact.md, EF-04, RSE-04) : 4 champs, aucune question de santé.
// Sans JavaScript, c'est un formulaire HTML classique vers /api/contact, contrôlé par le
// navigateur. Avec JavaScript, l'envoi se fait en arrière-plan : erreurs sous les champs,
// confirmation à la place du formulaire, saisie jamais perdue.
// Replié au départ (demande de Dylan du 12/11) : il s'ouvre avec « Demander une séance », ici ou
// depuis n'importe quel lien vers #contact. Sans JavaScript, il reste ouvert (balise noscript).

const ECHEC = "L’envoi a échoué. Réessayez, ou écrivez à contact@natur-oce.fr.";
const ORDRE: (keyof ErreursContact)[] = ["prenom", "email", "jour", "heure", "message"];

type Retour = { ok: boolean; erreurs?: ErreursContact; general?: string };

/** `edition` : dans « Mon accueil », ouvert et inactif (on le voit, on ne peut pas l'envoyer). */
export function FormulaireContact({ edition = false }: { edition?: boolean }) {
  const formulaire = useRef<HTMLFormElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const [erreurs, setErreurs] = useState<ErreursContact>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  const [ouvert, setOuvert] = useState(edition);
  const [vientDOuvrir, setVientDOuvrir] = useState(false);

  // Tous les « Demander une séance » de la page mènent à #contact : ils ouvrent aussi le formulaire.
  useEffect(() => {
    const ouvrirDepuisLien = () => {
      setOuvert(true);
      setVientDOuvrir(true);
    };
    // Arrivée directe sur /#contact : ouvert, sans animation (hors de l'effet lui-même).
    const arrivee = setTimeout(() => {
      if (location.hash === "#contact") setOuvert(true);
    }, 0);
    const surClic = (ev: MouseEvent) => {
      const lien = (ev.target as Element | null)?.closest?.('a[href$="#contact"]');
      if (lien) ouvrirDepuisLien();
    };
    const surHash = () => {
      if (location.hash === "#contact") ouvrirDepuisLien();
    };
    document.addEventListener("click", surClic);
    addEventListener("hashchange", surHash);
    return () => {
      clearTimeout(arrivee);
      document.removeEventListener("click", surClic);
      removeEventListener("hashchange", surHash);
    };
  }, []);

  const focusApresOuverture = useRef(false);
  function ouvrir() {
    focusApresOuverture.current = true;
    setOuvert(true);
    setVientDOuvrir(true);
  }

  // Ouvert par le bouton, qui disparaît : le clavier passe au premier champ. Ouvert par un lien,
  // on ne place pas le curseur (sur téléphone, le clavier surgirait).
  useEffect(() => {
    if (ouvert && focusApresOuverture.current) {
      focusApresOuverture.current = false;
      formulaire.current?.querySelector<HTMLElement>('[name="prenom"]')?.focus({ preventScroll: true });
    }
  }, [ouvert]);

  // Avec JavaScript, nos messages remplacent ceux du navigateur (plus précis, en français du site).
  const jour = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (formulaire.current) formulaire.current.noValidate = true;
    // Bornes du calendrier calculées ici : la page est figée en fichier, la date du jour change.
    const { min, max } = bornesJour();
    if (jour.current) Object.assign(jour.current, { min, max });
  }, []);

  useEffect(() => {
    if (envoyee) confirmation.current?.focus();
  }, [envoyee]);

  function signaler(trouvees: ErreursContact) {
    setErreurs(trouvees);
    const premier = ORDRE.find((c) => trouvees[c]);
    if (premier) formulaire.current?.querySelector<HTMLElement>(`[name="${premier}"]`)?.focus();
  }

  function lireChamps(form: HTMLFormElement): ChampsContact {
    const donnees = new FormData(form);
    const lire = (nom: string) => String(donnees.get(nom) ?? "");
    return { prenom: lire("prenom"), email: lire("email"), jour: lire("jour"), heure: lire("heure"), message: lire("message"), site: lire(CHAMP_PIEGE) };
  }

  // En quittant un champ, ou en corrigeant un champ déjà signalé : son erreur s'affiche ou s'efface
  // aussitôt (cadre rouge et phrase sous le champ), sans attendre l'envoi.
  function verifierChamp(nom: string, seulementSiSignale: boolean) {
    const champ = nom as keyof ErreursContact;
    if (!formulaire.current || !ORDRE.includes(champ)) return;
    if (seulementSiSignale && !erreurs[champ]) return;
    const valeurs = lireChamps(formulaire.current);
    // Un champ laissé vide sans y avoir rien écrit n'est signalé qu'à l'envoi.
    if (!seulementSiSignale && (valeurs[champ as keyof ChampsContact] ?? "") === "") return;
    const verdict = validerDemande(valeurs);
    const message = verdict.statut === "invalide" ? verdict.erreurs[champ] : undefined;
    setErreurs((e) => ({ ...e, [champ]: message }));
  }

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    setGeneral(null);

    const verdict = validerDemande(lireChamps(e.currentTarget));
    if (verdict.statut === "invalide") return signaler(verdict.erreurs);
    setErreurs({});

    setEnCours(true);
    try {
      const reponse = await fetch("/api/contact", { method: "POST", body: donnees, headers: { Accept: "application/json" } });
      const retour = (await reponse.json().catch(() => ({ ok: false }))) as Retour;
      if (retour.ok) setEnvoyee(true);
      else if (retour.erreurs) signaler(retour.erreurs);
      else setGeneral(retour.general ?? ECHEC);
    } catch {
      setGeneral(ECHEC);
    } finally {
      setEnCours(false);
    }
  }

  if (envoyee) {
    return (
      <div ref={confirmation} className="contact-envoye" role="status" tabIndex={-1}>
        <p className="contact-envoye-titre">Votre demande est envoyée.</p>
        <p>Merci. Océane vous répond par mail pour fixer la séance en visio.</p>
      </div>
    );
  }

  const aria = (champ: keyof ErreursContact, aide?: string) => ({
    "aria-invalid": erreurs[champ] ? true : undefined,
    "aria-describedby": [aide, erreurs[champ] ? `contact-${champ}-erreur` : null].filter(Boolean).join(" ") || undefined,
  });
  const erreur = (champ: keyof ErreursContact) =>
    erreurs[champ] && <p id={`contact-${champ}-erreur`} className="erreur-champ">{erreurs[champ]}</p>;
  const etoile = <span className="obligatoire" aria-hidden="true"> *</span>;

  return (
    <>
      {!ouvert && (
        <button type="button" className="bouton ouvrir-contact" aria-expanded="false" aria-controls="formulaire-contact" onClick={ouvrir}>
          Demander une séance
        </button>
      )}
      {/* Sans JavaScript : formulaire ouvert, bouton masqué (le bouton ne ferait rien). */}
      <noscript dangerouslySetInnerHTML={{ __html: "<style>.formulaire-contact.replie{display:grid}.ouvrir-contact{display:none}</style>" }} />
    <form ref={formulaire} id="formulaire-contact" action="/api/contact" method="post" onSubmit={envoyer} inert={edition || undefined}
      onBlur={(ev) => verifierChamp((ev.target as unknown as HTMLInputElement).name, false)}
      onChange={(ev) => verifierChamp((ev.target as unknown as HTMLInputElement).name, true)}
      className={["formulaire-contact", ouvert ? "" : "replie", vientDOuvrir ? "vient-d-ouvrir" : ""].filter(Boolean).join(" ")}>
      {general && <p role="alert" className="erreur-generale">{general}</p>}
      <p className="legende-obligatoire"><span aria-hidden="true">*</span> Champ obligatoire</p>

      <div className="champs-contact">
        <div className="champ-contact">
          <label htmlFor="contact-prenom">Prénom{etoile}</label>
          <input id="contact-prenom" name="prenom" required maxLength={LIMITES_CONTACT.prenom} autoComplete="given-name" {...aria("prenom")} />
          {erreur("prenom")}
        </div>
        <div className="champ-contact">
          <label htmlFor="contact-email">E-mail{etoile}</label>
          <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" pattern={MOTIF_EMAIL}
            title="Adresse complète, par exemple prenom@exemple.fr" {...aria("email")} />
          {erreur("email")}
        </div>
      </div>

      <fieldset className="creneau-contact" aria-describedby="contact-creneau-aide">
        <legend>Le créneau qui vous arrangerait <span className="facultatif">(facultatif)</span></legend>
        <p id="contact-creneau-aide" className="aide-champ">Choisissez un jour et une heure : Océane vous confirme par mail.</p>
        <div className="champs-creneau">
          <div className="champ-contact">
            <label htmlFor="contact-jour">Jour</label>
            <input ref={jour} id="contact-jour" name="jour" type="date" {...aria("jour")} />
            {erreur("jour")}
          </div>
          <div className="champ-contact">
            <label htmlFor="contact-heure">Heure</label>
            <input id="contact-heure" name="heure" type="time" min={CRENEAU.heureMin} max={CRENEAU.heureMax} step={CRENEAU.pasMinutes * 60}
              {...aria("heure")} />
            {erreur("heure")}
          </div>
        </div>
      </fieldset>

      <div className="champ-contact">
        <label htmlFor="contact-message">Votre message{etoile}</label>
        <textarea id="contact-message" name="message" required rows={5} maxLength={LIMITES_CONTACT.message}
          {...aria("message", "contact-message-aide")} />
        <p id="contact-message-aide" className="aide-champ">Inutile de décrire vos problèmes de santé : on en parlera pendant la séance.</p>
        {erreur("message")}
      </div>

      {/* Piège à robots (ENF-04) : invisible et hors du parcours clavier ; un humain ne le remplit pas. */}
      <div className="piege" aria-hidden="true">
        <label htmlFor="contact-site">Ne pas remplir ce champ</label>
        <input id="contact-site" name={CHAMP_PIEGE} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="envoi-contact">
        <button type="submit" className="bouton" disabled={enCours}>Envoyer ma demande</button>
        {enCours && <span role="status">Envoi en cours…</span>}
      </div>
    </form>
    </>
  );
}
