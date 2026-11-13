import { describe, expect, it } from "vitest";
import { LIMITES_CONTACT, LIMITE_ENVOIS, MOTIF_EMAIL, TAILLE_MAX_DEMANDE, bornesJour, creneauEnLettres, validerDemande as validerDemandeLe, type ChampsContact } from "@/lib/contact";

// Date du jour figée pour les tests du créneau : jeudi 12 novembre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-11-12T09:00:00Z");
const validerDemande = (c: ChampsContact) => validerDemandeLe(c, MAINTENANT);
import { adresseValide } from "@/lib/email/modeles";
import { modeleDemandeSeance, preparerEnvoi } from "@/lib/email/modeles";

// T12 · Formulaire de demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, RSE-04).

const valide = { prenom: "Léa", email: "lea@exemple.test", jour: "2026-11-18", heure: "18:30", message: "Bonjour, je prépare un semi-marathon.", site: "" };

describe("validerDemande", () => {
  it("une demande complète est acceptée, champs nettoyés", () => {
    expect(validerDemande({ ...valide, prenom: "  Léa ", email: " lea@exemple.test " })).toEqual({
      statut: "valide",
      demande: { prenom: "Léa", email: "lea@exemple.test", disponibilites: "mercredi 18 novembre 2026 à 18 h 30", creneau: { jour: "2026-11-18", heure: "18:30" }, message: "Bonjour, je prépare un semi-marathon." },
    });
  });

  it("le créneau est facultatif ; jour et heure vont ensemble", () => {
    expect(validerDemande({ ...valide, jour: "", heure: " " })).toMatchObject({ statut: "valide", demande: { disponibilites: undefined } });
    expect(validerDemande({ ...valide, heure: "" })).toEqual({ statut: "invalide", erreurs: { heure: "Indiquez aussi l’heure." } });
    expect(validerDemande({ ...valide, jour: "" })).toEqual({ statut: "invalide", erreurs: { jour: "Choisissez aussi le jour." } });
  });

  it("le jour va d'aujourd'hui (heure de Paris) à 6 mois ; l'heure de 8 h à 20 h", () => {
    expect(bornesJour(MAINTENANT)).toEqual({ min: "2026-11-12", max: "2027-05-12" });
    expect(validerDemande({ ...valide, jour: "2026-11-12" }).statut).toBe("valide");
    expect(validerDemande({ ...valide, jour: "2026-11-11" })).toMatchObject({ erreurs: { jour: "Choisissez un jour à partir d’aujourd’hui." } });
    expect(validerDemande({ ...valide, jour: "2027-05-13" })).toMatchObject({ erreurs: { jour: "Choisissez un jour dans les 6 prochains mois." } });
    expect(validerDemande({ ...valide, jour: "2026-02-30" })).toMatchObject({ erreurs: { jour: "Choisissez un jour dans le calendrier." } });
    expect(validerDemande({ ...valide, heure: "07:45" })).toMatchObject({ erreurs: { heure: "Choisissez une heure entre 8 h et 20 h." } });
    expect(validerDemande({ ...valide, heure: "20:00" }).statut).toBe("valide");
    expect(validerDemande({ ...valide, heure: "midi" })).toMatchObject({ erreurs: { heure: "Choisissez une heure entre 8 h et 20 h." } });
  });

  it("le créneau s'écrit en toutes lettres dans le message à Océane", () => {
    expect(creneauEnLettres("2026-11-18", "18:30")).toBe("mercredi 18 novembre 2026 à 18 h 30");
    expect(creneauEnLettres("2026-12-05", "09:00")).toBe("samedi 5 décembre 2026 à 9 h");
  });

  it("le champ piège rempli → robot, quel que soit le reste (rien ne sera envoyé)", () => {
    expect(validerDemande({ ...valide, site: "https://spam.example" })).toEqual({ statut: "robot" });
    expect(validerDemande({ prenom: "", email: "x", jour: "", heure: "", message: "", site: "x" })).toEqual({ statut: "robot" });
  });

  it("champs obligatoires vides et adresse invalide → chaque champ fautif est signalé", () => {
    const r = validerDemande({ prenom: " ", email: "lea@", jour: "", heure: "", message: "", site: "" });
    expect(r).toEqual({
      statut: "invalide",
      erreurs: {
        prenom: "Indiquez votre prénom.",
        email: "Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.",
        message: "Écrivez quelques mots sur votre demande.",
      },
    });
  });

  it("une adresse avec retour à la ligne (injection d'en-tête) est refusée", () => {
    expect(validerDemande({ ...valide, email: "lea@exemple.test\nBcc: pirate@exemple.test" })).toMatchObject({ statut: "invalide" });
  });

  it("les longueurs maximales sont signalées, avec le dépassement", () => {
    const r = validerDemande({
      ...valide,
      prenom: "x".repeat(LIMITES_CONTACT.prenom + 1),
      message: "z".repeat(LIMITES_CONTACT.message + 3),
    });
    expect(r).toEqual({
      statut: "invalide",
      erreurs: {
        prenom: "Le prénom dépasse 60 caractères.",
        // « 1 500 » avec l'espace fine insécable d'Intl : le nombre ne se coupe pas en fin de ligne.
        message: expect.stringMatching(/^Le message dépasse 1[  ]500 caractères \(3 en trop\)\.$/),
      },
    });
  });

  it("un message de 1 500 caractères tout juste passe (emoji compté pour un)", () => {
    const message = "🌿" + "a".repeat(LIMITES_CONTACT.message - 1);
    expect(validerDemande({ ...valide, message }).statut).toBe("valide");
  });
});

describe("limite et message envoyé", () => {
  it("5 envois par heure et par adresse IP (ENF-04)", () => {
    expect(LIMITE_ENVOIS).toEqual({ max: 5, fenetreMs: 60 * 60 * 1000 });
  });

  it("Océane répond directement au visiteur : Reply-To = son adresse (ENF-06)", () => {
    const r = validerDemande(valide);
    if (r.statut !== "valide") throw new Error("demande attendue valide");
    const envoi = preparerEnvoi(modeleDemandeSeance(r.demande), "oceane@exemple.test");
    expect(envoi.replyTo).toBe("lea@exemple.test");
    expect(envoi.to).toBe("oceane@exemple.test");
  });
});

describe("garde-fous de l'envoi (revue du point de contrôle final)", () => {
  it("le motif HTML du champ e-mail suit exactement la règle du serveur (même sans JavaScript)", () => {
    // Comme le navigateur : motif ancré, drapeau v.
    const motif = new RegExp(`^(?:${MOTIF_EMAIL})$`, "v");
    for (const adresse of ["lea@exemple.test", "sophie.durand@exemple.fr", "o'brien@exemple.test", "lea@exemple", "lea@", "@exemple.fr", "lea @exemple.fr", "lea@ex<ample.fr", "a@b.c"]) {
      expect(motif.test(adresse), adresse).toBe(adresseValide(adresse));
    }
    expect(motif.test("sophie@exemple.fr")).toBe(true); // une adresse avec des « s » passe
  });

  it("un envoi complet tient largement sous le plafond lu avant tout traitement", () => {
    expect(TAILLE_MAX_DEMANDE).toBe(16_384);
    const corps = new URLSearchParams({
      prenom: "x".repeat(LIMITES_CONTACT.prenom), email: "x".repeat(240) + "@exemple.fr",
      jour: "2026-11-18", heure: "18:30", message: "é".repeat(LIMITES_CONTACT.message), site: "",
    }).toString();
    expect(new TextEncoder().encode(corps).length).toBeLessThan(TAILLE_MAX_DEMANDE);
  });
});
