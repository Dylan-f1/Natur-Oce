import { describe, expect, it } from "vitest";
import {
  adresseValide,
  echapperHtml,
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
    expect(html).not.toContain("<img");
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
