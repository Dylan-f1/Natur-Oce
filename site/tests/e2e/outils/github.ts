// Pilotage du faux GitHub des tests (outils/faux-github.mjs, lancé par playwright.config.ts).
export const FAUX_GITHUB = "http://127.0.0.1:8796";

export type AppelPublication = { depot: string; corps: { ref?: string }; autorisation: string | null; agent: string | null };

export async function appelsPublication(): Promise<AppelPublication[]> {
  return (await fetch(`${FAUX_GITHUB}/_faux/appels`)).json();
}

export async function reinitialiserGithub(): Promise<void> {
  await fetch(`${FAUX_GITHUB}/_faux/reinitialiser`, { method: "POST" });
}

export async function reglerGithub(reglages: {
  lancement?: number;
  derniere?: { status: string; conclusion: string | null; updated_at: string } | null;
}): Promise<void> {
  await fetch(`${FAUX_GITHUB}/_faux/reglages`, { method: "POST", body: JSON.stringify(reglages) });
}
