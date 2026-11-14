import { describe, expect, it } from "vitest";
import {
  adresseValide,
  echapperHtml,
  modeleConfirmationRdv,
  modeleDemandeSeance,
  modeleLienConnexion,
  nettoyerSujet,
  preparerEnvoi,
} from "@/lib/email/modeles";

describe("echapperHtml", () => {
  it("neutralise les balises et les guillemets", () => {
    expect(echapperHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });
});

describe("nettoyerSujet (pas d'injection d'en-têtes)", () => {
  it("retire les retours à la ligne", () => {
    expect(nettoyerSujet("Demande\r\nBcc: pirate@exemple.test")).toBe("Demande Bcc: pirate@exemple.test");
  });
  it("coupe à 100 caractères", () => {
    const sujet = nettoyerSujet("a".repeat(150));
    expect(sujet).toHaveLength(100);
    expect(sujet.endsWith("…")).toBe(true);
  });
});

describe("adresseValide", () => {
  it.each(["visiteur@exemple.test", "prenom.nom+rdv@sous.domaine.fr"])("accepte %s", (a) => {
    expect(adresseValide(a)).toBe(true);
  });
  it.each(["", "sans-arobase", "a@b", "a@b.fr\nBcc: x@y.fr", "a@b.fr, c@d.fr", "<a@b.fr>"])(
    "refuse « %s »",
    (a) => {
      expect(adresseValide(a)).toBe(false);
    },
  );
});

describe("modeleDemandeSeance (EF-04, ENF-06)", () => {
  const demande = {
    prenom: "Léa <b>",
    email: "lea@exemple.test",
    disponibilites: "",
    message: "Bonjour,\n<img src=x onerror=alert(1)>",
  };

  it("échappe tout ce qui vient du visiteur dans le HTML", () => {
    const { html } = modeleDemandeSeance(demande);
    expect(html).not.toContain("<b>");
    expect(html.match(/<img/g)).toHaveLength(1); // le logo du bandeau, rien du visiteur
    expect(html).not.toContain("onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("met l'adresse du visiteur en Reply-To et un sujet sur une ligne", () => {
    const envoi = preparerEnvoi(modeleDemandeSeance(demande), "oceane@exemple.test");
    expect(envoi.replyTo).toBe("lea@exemple.test");
    expect(envoi.to).toBe("oceane@exemple.test");
    expect(envoi.subject).toBe("Nouvelle demande de séance — Léa <b>");
    expect(envoi.subject).not.toMatch(/[\r\n]/);
  });

  it("indique « non précisées » sans disponibilités", () => {
    expect(modeleDemandeSeance(demande).texte).toContain("Disponibilités : non précisées");
  });

  it("n'ajoute pas de Reply-To si l'adresse est douteuse", () => {
    const envoi = preparerEnvoi(
      modeleDemandeSeance({ ...demande, email: "x@y.fr\nBcc: z@w.fr" }),
      "oceane@exemple.test",
    );
    expect(envoi).not.toHaveProperty("replyTo");
  });
});

describe("modeleLienConnexion", () => {
  const url = "https://natur-oce.fr/api/auth/magic-link/verify?token=abc&callbackURL=%2Fadmin";

  it("contient le lien une seule fois en texte et la mention de sécurité", () => {
    const { texte } = modeleLienConnexion(url);
    expect(texte.split(url)).toHaveLength(2);
    expect(texte).toContain("valable 10 minutes");
    expect(texte).toContain("Si vous n’avez rien demandé, ignorez ce message.");
  });

  it("échappe le lien dans le HTML", () => {
    expect(modeleLienConnexion(url).html).toContain("token=abc&amp;callbackURL");
  });
});

describe("e-mails « Bandeau olive » et réponses en un clic (13/11)", () => {
  const demande = {
    prenom: "Léa",
    email: "lea@exemple.test",
    disponibilites: "mercredi 18 novembre 2026 à 18 h 30",
    creneau: { jour: "2026-11-18", heure: "18:30" },
    message: "Bonjour, je prépare un semi-marathon.",
  };

  it("bandeau olive avec le logo en PNG", () => {
    const { html } = modeleDemandeSeance(demande);
    expect(html).toContain("background:#3D491B");
    expect(html).toContain('src="https://natur-oce.fr/logo-email.png"');
  });

  it("deux boutons : « Confirmer ce créneau » et « Proposer un autre créneau », en mailto pré-rempli", () => {
    const { html } = modeleDemandeSeance(demande);
    const liens = [...html.matchAll(/href="(mailto:[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(liens).toHaveLength(2);
    const confirmer = new URL(liens[0]);
    expect(confirmer.pathname).toBe("lea@exemple.test");
    expect(confirmer.searchParams.get("subject")).toBe("Votre séance du mercredi 18 novembre 2026 à 18 h 30");
    expect(confirmer.searchParams.get("body")).toContain("je vous retrouve en visio le mercredi 18 novembre 2026 à 18 h 30");
    expect(confirmer.searchParams.get("body")).toContain("[lien de visio]");
    expect(html).toContain("Proposer un autre créneau");
  });

  it("sans créneau : un seul bouton « Proposer un créneau », pas de fichier d'agenda", () => {
    const m = modeleDemandeSeance({ ...demande, disponibilites: undefined, creneau: undefined });
    expect([...m.html.matchAll(/href="mailto:/g)]).toHaveLength(1);
    expect(m.html).toContain("Proposer un créneau");
    expect(m.piecesJointes).toBeUndefined();
  });

  it("adresse douteuse : aucun bouton mailto", () => {
    expect(modeleDemandeSeance({ ...demande, email: "a b@c.d" }).html).not.toContain("mailto:");
  });

  it("le créneau est joint en seance.ics, et passe en pièce jointe à l'envoi", () => {
    const m = modeleDemandeSeance(demande);
    expect(m.piecesJointes?.[0]).toMatchObject({ filename: "seance.ics", type: "text/calendar" });
    expect(m.piecesJointes?.[0].content).toContain("DTSTART:20261118T173000Z"); // 18 h 30 à Paris = 17 h 30 UTC
    const envoi = preparerEnvoi(m, "oceane@exemple.test");
    expect(envoi.attachments?.[0]).toMatchObject({ filename: "seance.ics", disposition: "attachment" });
  });
});


describe("confirmation du rendez-vous (T21)", () => {
  const demande = {
    prenom: "Léa",
    email: "lea@exemple.test",
    disponibilites: "mercredi 18 novembre 2026 à 18 h 30",
    creneau: { jour: "2026-11-18", heure: "18:30" },
    message: "Bonjour.",
  };

  it("avec le lien chiffré : « Confirmer » pointe vers la page, « Proposer un autre créneau » reste un mailto", () => {
    const m = modeleDemandeSeance({ ...demande, lienConfirmation: "https://natur-oce.fr/rendez-vous/confirmer?j=v1.abc" });
    expect(m.html).toContain('href="https://natur-oce.fr/rendez-vous/confirmer?j=v1.abc"');
    expect([...m.html.matchAll(/href="mailto:/g)]).toHaveLength(1);
    expect(m.html).toContain("Proposer un autre créneau");
    expect(m.texte).toContain("Confirmer ce créneau en un clic (lien valable 7 jours) : https://natur-oce.fr/rendez-vous/confirmer?j=v1.abc");
  });

  it("un lien qui n'est pas une adresse web est ignoré (retour à la réponse pré-écrite)", () => {
    const m = modeleDemandeSeance({ ...demande, lienConfirmation: "javascript:alert(1)" });
    expect(m.html).not.toContain("javascript:");
    expect([...m.html.matchAll(/href="mailto:/g)]).toHaveLength(2);
  });

  it("e-mail du client : Bandeau olive, date en grand, bouton visio, durée, sans message recopié", () => {
    const m = modeleConfirmationRdv(
      { prenom: "Léa", jour: "2026-11-18", heure: "18:30", dureeMinutes: 90, lienVisio: "https://meet.google.com/abc-defg-hij" },
      "mercredi 18 novembre 2026 à 18 h 30",
    );
    expect(m.sujet).toBe("Votre séance est confirmée — mercredi 18 novembre 2026 à 18 h 30");
    expect(m.html).toContain("background:#3D491B");
    expect(m.html).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(m.html).toContain("Rejoindre la visio");
    expect(m.html).toContain("18 h 30");
    expect(m.html).toContain("1 h 30");
    expect(m.html).toContain(">18<"); // le jour du mois, en grand
    expect(m.html).toContain("mercredi");
    expect(m.texte.startsWith("Bonjour Léa,")).toBe(true);
    expect(m.texte).toContain("Lien de la visio : https://meet.google.com/abc-defg-hij");
    expect(m.texte).toContain("ne remplace pas un avis médical");
  });

  it("prénom douteux : « Bonjour, » ; lien de visio échappé dans le HTML", () => {
    const m = modeleConfirmationRdv(
      { prenom: "<script>", jour: "2026-12-05", heure: "09:00", dureeMinutes: 60, lienVisio: 'https://exemple.fr/a?b=1&c="2"' },
      "samedi 5 décembre 2026 à 9 h",
    );
    expect(m.texte.startsWith("Bonjour,")).toBe(true);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&amp;c=&quot;2&quot;");
  });
});
