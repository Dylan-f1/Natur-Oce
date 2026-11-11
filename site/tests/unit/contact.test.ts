import { describe, expect, it } from "vitest";
import { LIMITES_CONTACT, LIMITE_ENVOIS, MOTIF_EMAIL, TAILLE_MAX_DEMANDE, validerDemande } from "@/lib/contact";
import { adresseValide } from "@/lib/email/modeles";
import { modeleDemandeSeance, preparerEnvoi } from "@/lib/email/modeles";

// T12 · Formulaire de demande de séance (specs/SPEC-contact.md, EF-04, ENF-04, RSE-04).

const valide = { prenom: "Léa", email: "lea@exemple.test", disponibilites: "le mardi soir", message: "Bonjour, je prépare un semi-marathon.", site: "" };

describe("validerDemande", () => {
  it("une demande complète est acceptée, champs nettoyés", () => {
    expect(validerDemande({ ...valide, prenom: "  Léa ", email: " lea@exemple.test " })).toEqual({
      statut: "valide",
      demande: { prenom: "Léa", email: "lea@exemple.test", disponibilites: "le mardi soir", message: "Bonjour, je prépare un semi-marathon." },
    });
  });

  it("les disponibilités sont facultatives", () => {
    const r = validerDemande({ ...valide, disponibilites: "   " });
    expect(r).toMatchObject({ statut: "valide", demande: { disponibilites: undefined } });
  });

  it("le champ piège rempli → robot, quel que soit le reste (rien ne sera envoyé)", () => {
    expect(validerDemande({ ...valide, site: "https://spam.example" })).toEqual({ statut: "robot" });
    expect(validerDemande({ prenom: "", email: "x", disponibilites: "", message: "", site: "x" })).toEqual({ statut: "robot" });
  });

  it("champs obligatoires vides et adresse invalide → chaque champ fautif est signalé", () => {
    const r = validerDemande({ prenom: " ", email: "lea@", disponibilites: "", message: "", site: "" });
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
      disponibilites: "y".repeat(LIMITES_CONTACT.disponibilites + 1),
      message: "z".repeat(LIMITES_CONTACT.message + 3),
    });
    expect(r).toEqual({
      statut: "invalide",
      erreurs: {
        prenom: "Le prénom dépasse 60 caractères.",
        disponibilites: "Les disponibilités dépassent 200 caractères.",
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
      disponibilites: "x".repeat(LIMITES_CONTACT.disponibilites), message: "é".repeat(LIMITES_CONTACT.message), site: "",
    }).toString();
    expect(new TextEncoder().encode(corps).length).toBeLessThan(TAILLE_MAX_DEMANDE);
  });
});
