"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAMP_PIEGE, LIMITES_CONTACT, validerDemande, type ErreursContact } from "@/lib/contact";
import "./formulaire-contact.css";

// Demande de séance (specs/SPEC-contact.md, EF-04, RSE-04) : 4 champs, aucune question de santé.
// Sans JavaScript, c'est un formulaire HTML classique vers /api/contact, contrôlé par le
// navigateur. Avec JavaScript, l'envoi se fait en arrière-plan : erreurs sous les champs,
// confirmation à la place du formulaire, saisie jamais perdue.

const ECHEC = "L’envoi a échoué. Réessayez, ou écrivez à contact@natur-oce.fr.";
const ORDRE: (keyof ErreursContact)[] = ["prenom", "email", "disponibilites", "message"];

type Retour = { ok: boolean; erreurs?: ErreursContact; general?: string };

export function FormulaireContact() {
  const formulaire = useRef<HTMLFormElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const [erreurs, setErreurs] = useState<ErreursContact>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);

  // Avec JavaScript, nos messages remplacent ceux du navigateur (plus précis, en français du site).
  useEffect(() => {
    if (formulaire.current) formulaire.current.noValidate = true;
  }, []);

  useEffect(() => {
    if (envoyee) confirmation.current?.focus();
  }, [envoyee]);

  function signaler(trouvees: ErreursContact) {
    setErreurs(trouvees);
    const premier = ORDRE.find((c) => trouvees[c]);
    if (premier) formulaire.current?.querySelector<HTMLElement>(`[name="${premier}"]`)?.focus();
  }

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    const lire = (nom: string) => String(donnees.get(nom) ?? "");
    setGeneral(null);

    const verdict = validerDemande({
      prenom: lire("prenom"), email: lire("email"), disponibilites: lire("disponibilites"),
      message: lire("message"), site: lire(CHAMP_PIEGE),
    });
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

  return (
    <form ref={formulaire} action="/api/contact" method="post" className="formulaire-contact" onSubmit={envoyer}>
      {general && <p role="alert" className="erreur-generale">{general}</p>}

      <div className="champs-contact">
        <div className="champ-contact">
          <label htmlFor="contact-prenom">Prénom</label>
          <input id="contact-prenom" name="prenom" required maxLength={LIMITES_CONTACT.prenom} autoComplete="given-name" {...aria("prenom")} />
          {erreur("prenom")}
        </div>
        <div className="champ-contact">
          <label htmlFor="contact-email">E-mail</label>
          <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" {...aria("email")} />
          {erreur("email")}
        </div>
      </div>

      <div className="champ-contact">
        <label htmlFor="contact-disponibilites">Vos disponibilités <span className="facultatif">(facultatif)</span></label>
        <input id="contact-disponibilites" name="disponibilites" maxLength={LIMITES_CONTACT.disponibilites} autoComplete="off"
          {...aria("disponibilites", "contact-disponibilites-aide")} />
        <p id="contact-disponibilites-aide" className="aide-champ">Par exemple : le mardi soir, le samedi matin.</p>
        {erreur("disponibilites")}
      </div>

      <div className="champ-contact">
        <label htmlFor="contact-message">Votre message</label>
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
  );
}
