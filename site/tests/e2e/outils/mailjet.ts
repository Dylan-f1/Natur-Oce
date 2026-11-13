// Pilotage du faux Mailjet des tests (outils/faux-mailjet.mjs, lancé par playwright.config.ts).
export const FAUX_MAILJET = "http://127.0.0.1:8797";

export type EnvoiMailjet = {
  autorisation: string | null;
  corps: { Messages: { From: { Email: string }; To: { Email: string; Name?: string }[]; ReplyTo: { Email: string }; Subject: string; TextPart: string; HTMLPart: string; TrackOpens: string }[] };
};

export async function envoisMailjet(): Promise<EnvoiMailjet[]> {
  return (await fetch(`${FAUX_MAILJET}/_faux/appels`)).json();
}

export async function reinitialiserMailjet(): Promise<void> {
  await fetch(`${FAUX_MAILJET}/_faux/reinitialiser`, { method: "POST" });
}

export async function reglerMailjet(statut: number): Promise<void> {
  await fetch(`${FAUX_MAILJET}/_faux/reglages`, { method: "POST", body: JSON.stringify({ statut }) });
}
