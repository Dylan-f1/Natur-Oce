import { expect, test } from "@playwright/test";
import { getPlatformProxy } from "wrangler";
import { envoyerAvec } from "@/lib/email";
import { modeleDemandeSeance } from "@/lib/email/modeles";
import { attendreEmail } from "./outils/emails";

// T3 · Un envoi passe par le vrai binding `send_email` simulé par miniflare (specs/SPEC-envoi-email.md).
// getPlatformProxy donne en Node les mêmes bindings que `wrangler dev`, sans route de test dans le site.
test("un envoi vers Océane produit un message simulé lisible", async () => {
  const proxy = await getPlatformProxy<CloudflareEnv>({ configPath: "wrangler.jsonc" });
  try {
    expect(proxy.env.ADMIN_EMAIL).toBe("oceane@exemple.test"); // adresse fictive de .dev.vars
    const depuis = Date.now();
    const resultat = await envoyerAvec(
      proxy.env.EMAIL,
      proxy.env.ADMIN_EMAIL,
      modeleDemandeSeance({
        prenom: "Léa",
        email: "lea@exemple.test",
        disponibilites: "le mardi soir",
        message: "Bonjour, je prépare un semi-marathon.",
      }),
    );
    expect(resultat.messageId).toMatch(/@natur-oce\.fr>?$/);

    const texte = await attendreEmail(depuis);
    expect(texte).toContain("Nouvelle demande de séance de Léa (lea@exemple.test).");
    expect(texte).toContain("Disponibilités : le mardi soir");
    expect(texte).toContain("Bonjour, je prépare un semi-marathon.");
  } finally {
    await proxy.dispose();
  }
});
