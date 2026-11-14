import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { env } from "@/lib/cloudflare";
import { creneauEnLettres } from "@/lib/contact";
import { confirmationReservee } from "@/lib/db/confirmations";
import { lireReglages } from "@/lib/db/reglages";
import { dureeEnLettres } from "@/lib/email/modeles";
import { cleLimite } from "@/lib/limite";
import { creneauPasse, lireJeton } from "@/lib/rendezvous";
import "./confirmer.css";

// Confirmer un rendez-vous (T21, specs/SPEC-emails-client.md). Lien chiffré reçu par Océane, sans
// connexion. Jamais figée par l'instantané (le jeton est dans l'adresse) : rendue à chaque visite,
// sans cache, sans index, sans référent vers un autre site. En GET elle n'envoie rien : seul le bouton (POST) envoie.
export const metadata: Metadata = {
  title: "Confirmer un rendez-vous",
  robots: { index: false, follow: false },
  referrer: "same-origin", // jamais transmis à un autre site ; « no-referrer » ferait envoyer Origin: null au formulaire
};

const ERREURS: Record<string, string> = {
  envoi: "La confirmation n’a pas pu partir. Rien n’a été envoyé : réessayez dans un instant.",
  plafond: "Trop de confirmations envoyées aujourd’hui. Réessayez demain, ou répondez directement à la demande.",
};

export default async function ConfirmerRendezVous({ searchParams }: PageProps<"/rendez-vous/confirmer">) {
  await connection();
  const p = await searchParams;
  const jeton = typeof p.j === "string" ? p.j : "";
  const erreur = typeof p.erreur === "string" ? ERREURS[p.erreur] : undefined;

  const variables = await env();
  const lu = jeton ? await lireJeton(jeton, variables.BETTER_AUTH_SECRET) : null;

  let contenu;
  if (!lu || !lu.ok) {
    contenu = (
      <>
        <h1>Ce lien n’est plus valable</h1>
        <div className="avis avis-erreur">
          <p>Les liens de confirmation sont valables 7 jours. Répondez directement à la demande depuis votre messagerie.</p>
        </div>
      </>
    );
  } else {
    const { rdv } = lu;
    const deja = await confirmationReservee(await cleLimite("confirmation", jeton));
    const enLettres = creneauEnLettres(rdv.jour, rdv.heure);
    if (deja) {
      contenu = (
        <>
          <h1>Confirmation envoyée</h1>
          <div className="avis avis-ok" role="status">
            <p>
              {rdv.prenom} a reçu le rendez-vous du {enLettres}, avec le lien de la visio et le fichier d’agenda. Sa réponse
              éventuelle arrivera dans votre boîte.
            </p>
          </div>
        </>
      );
    } else if (creneauPasse(rdv.jour, rdv.heure)) {
      contenu = (
        <>
          <h1>Ce créneau est passé</h1>
          <div className="avis avis-erreur">
            <p>Le {enLettres} est déjà passé : rien n’a été envoyé. Proposez un autre créneau depuis l’e-mail de la demande.</p>
          </div>
        </>
      );
    } else {
      let reglages: Awaited<ReturnType<typeof lireReglages>> | null = null;
      try {
        reglages = await lireReglages();
      } catch (e) {
        console.error("[confirmation] réglages illisibles", e);
      }
      if (!reglages) {
        contenu = (
          <>
            <h1>Une erreur est survenue</h1>
            <div className="avis avis-erreur" role="alert">
              <p>Les réglages n’ont pas pu être lus. Rien n’a été envoyé : rechargez la page dans un instant.</p>
            </div>
          </>
        );
      } else if (!reglages.lienVisio) {
        contenu = (
          <>
            <h1>Indiquez d’abord votre lien de visio</h1>
            <div className="avis avis-erreur">
              <p>
                La confirmation donne au client le lien de la séance. Ajoutez votre lien de visio dans les Réglages, puis
                revenez sur cette page : rien n’a été envoyé.
              </p>
            </div>
            <a className="bouton" href="/admin/reglages">Ouvrir les Réglages</a>
          </>
        );
      } else {
        contenu = (
          <>
            <h1>Confirmer le rendez-vous de {rdv.prenom} ?</h1>
            <p className="chapeau">
              {rdv.prenom} recevra un e-mail de confirmation avec le lien de la visio et un fichier pour l’ajouter à son agenda.
            </p>
            {erreur && <div className="avis avis-erreur" role="alert"><p>{erreur}</p></div>}
            <div className="etiquette">
              <dl>
                <dt>Avec</dt><dd>{rdv.prenom} · {rdv.email}</dd>
                <dt>Le</dt><dd>{enLettres}</dd>
                <dt>Durée</dt><dd>{dureeEnLettres(reglages.dureeMinutes)}</dd>
                <dt>Visio</dt><dd>{reglages.lienVisio}</dd>
              </dl>
            </div>
            <form method="post" action="/api/rendez-vous/confirmer">
              <input type="hidden" name="j" value={jeton} />
              <button type="submit" className="bouton">Envoyer la confirmation</button>
            </form>
            <p className="aide">Le créneau ne convient plus ? Fermez cette page et utilisez « Proposer un autre créneau » dans l’e-mail.</p>
          </>
        );
      }
    }
  }

  return (
    <main className="cadre page-confirmer">
      <div className="entete-confirmer">
        <Image src="/logo-natur-oce-144.webp" alt="" width={52} height={52} />
        <span>Natur’Océ</span>
      </div>
      {contenu}
    </main>
  );
}
