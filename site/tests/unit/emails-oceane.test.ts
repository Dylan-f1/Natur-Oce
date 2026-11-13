import { describe, expect, it, vi } from "vitest";
import { envoyerAOceaneAvec, versMailjet } from "@/lib/email";
import { corpsMailjet, type ConfigMailjet, type IssueMailjet, type MessageClient } from "@/lib/email/mailjet";

type EnvoiMailjet = (c: ConfigMailjet, m: MessageClient) => Promise<IssueMailjet>;
import { modeleDemandeSeance, modeleLienConnexion } from "@/lib/email/modeles";

// E-mails d'Océane par Mailjet d'abord, Cloudflare en secours (13/11 : Outlook écartait ceux de Cloudflare).

const config = { cle: "a", secret: "b", api: "https://api.mailjet.com" };
const demande = modeleDemandeSeance({
  prenom: "Léa", email: "lea@exemple.test", disponibilites: "mercredi 18 novembre 2026 à 18 h 30",
  creneau: { jour: "2026-11-18", heure: "18:30" }, message: "Bonjour.",
});

function bindingFactice() {
  return { send: vi.fn(async () => ({ messageId: "x" })) } as unknown as SendEmail & { send: ReturnType<typeof vi.fn> };
}

describe("envoyerAOceaneAvec", () => {
  it("Mailjet configuré et qui répond : Mailjet seulement", async () => {
    const binding = bindingFactice();
    const envoyerMailjet = vi.fn<EnvoiMailjet>(async () => ({ ok: true }));
    expect(await envoyerAOceaneAvec({ message: demande, adminEmail: "oceane@exemple.test", mailjet: config, binding, envoyerMailjet })).toBe("mailjet");
    expect(binding.send).not.toHaveBeenCalled();
    expect(envoyerMailjet.mock.calls[0][1]).toMatchObject({ destinataire: { email: "oceane@exemple.test" }, repondreA: "lea@exemple.test" });
  });

  it("Mailjet en échec : Cloudflare en secours", async () => {
    const binding = bindingFactice();
    const envoyerMailjet = vi.fn<EnvoiMailjet>(async () => ({ ok: false, raison: "500" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await envoyerAOceaneAvec({ message: demande, adminEmail: "oceane@exemple.test", mailjet: config, binding, envoyerMailjet })).toBe("cloudflare");
    expect(binding.send).toHaveBeenCalledTimes(1);
  });

  it("sans Mailjet : Cloudflare directement", async () => {
    const binding = bindingFactice();
    expect(await envoyerAOceaneAvec({ message: modeleLienConnexion("https://natur-oce.fr/x"), adminEmail: "oceane@exemple.test", mailjet: null, binding })).toBe("cloudflare");
    expect(binding.send).toHaveBeenCalledTimes(1);
  });
});

describe("versMailjet", () => {
  it("expéditeur contact@, réponse au visiteur, fichier d'agenda en base64", () => {
    const [m] = corpsMailjet(versMailjet(demande, "oceane@exemple.test")).Messages;
    expect(m.From).toEqual({ Email: "contact@natur-oce.fr", Name: "Natur’Océ (site)" });
    expect(m.To).toEqual([{ Email: "oceane@exemple.test" }]);
    expect(m.ReplyTo).toEqual({ Email: "lea@exemple.test" });
    expect(m.Subject).toBe("Nouvelle demande de séance — Léa");
    const piece = (m as unknown as { Attachments: { Filename: string; ContentType: string; Base64Content: string }[] }).Attachments[0];
    expect(piece).toMatchObject({ Filename: "seance.ics", ContentType: "text/calendar" });
    expect(Buffer.from(piece.Base64Content, "base64").toString("utf8")).toContain("SUMMARY:Séance avec Léa (à confirmer)");
  });

  it("lien de connexion : pas de réponse au visiteur ni de pièce jointe", () => {
    const [m] = corpsMailjet(versMailjet(modeleLienConnexion("https://natur-oce.fr/x"), "oceane@exemple.test")).Messages;
    expect(m.ReplyTo).toEqual({ Email: "contact@natur-oce.fr", Name: "Océane — Natur’Océ" });
    expect(m).not.toHaveProperty("Attachments");
  });
});
