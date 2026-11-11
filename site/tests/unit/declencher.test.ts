import { describe, expect, it } from "vitest";
import {
  demanderPublication,
  lireConfigPublication,
  lireDernierePublication,
  type ConfigPublication,
} from "@/lib/publication/declencher";

// P3 · Déclenchement de la publication par l'administration (specs/SPEC-publication.md, D-21).

const config: ConfigPublication = {
  jeton: "jeton-de-test",
  depot: "Dylan-f1/Natur-Oce",
  branche: "main",
  api: "https://api.github.com",
};

type Appel = { url: string; init: RequestInit };

/** Faux fetch : enregistre les appels et renvoie la réponse donnée (ou lève l'erreur). */
function fauxFetch(reponse: Response | Error) {
  const appels: Appel[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init: init ?? {} });
    if (reponse instanceof Error) throw reponse;
    return reponse.clone();
  }) as typeof fetch;
  return { f, appels };
}

describe("lireConfigPublication", () => {
  it("sans jeton, la publication automatique est désactivée (développement local)", () => {
    expect(lireConfigPublication({})).toBeNull();
    expect(lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "" })).toBeNull();
  });

  it("avec un jeton : dépôt, branche et API par défaut", () => {
    expect(lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "x" })).toEqual({
      jeton: "x",
      depot: "Dylan-f1/Natur-Oce",
      branche: "main",
      api: "https://api.github.com",
    });
  });

  it("accepte un faux GitHub local pour les tests, et rien d'autre", () => {
    expect(lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "x", GITHUB_API_URL: "http://127.0.0.1:8796" })?.api).toBe("http://127.0.0.1:8796");
    for (const api of ["https://evil.example", "http://api.github.com", "http://10.0.0.1:80"]) {
      expect(() => lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "x", GITHUB_API_URL: api }), api).toThrow(/GITHUB_API_URL/);
    }
  });

  it("refuse un dépôt ou une branche mal formés", () => {
    expect(() => lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "x", GITHUB_DEPOT: "../x" })).toThrow(/GITHUB_DEPOT/);
    expect(() => lireConfigPublication({ GITHUB_PUBLICATION_TOKEN: "x", GITHUB_BRANCHE: "main;rm" })).toThrow(/GITHUB_BRANCHE/);
  });
});

describe("demanderPublication", () => {
  it("lance le workflow « publier » sur la branche, avec le jeton et les en-têtes demandés par GitHub", async () => {
    const { f, appels } = fauxFetch(new Response(null, { status: 204 }));
    expect(await demanderPublication(config, f)).toEqual({ ok: true });
    expect(appels).toHaveLength(1);
    const { url, init } = appels[0];
    expect(url).toBe("https://api.github.com/repos/Dylan-f1/Natur-Oce/actions/workflows/publier.yml/dispatches");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main" });
    const entetes = new Headers(init.headers);
    expect(entetes.get("authorization")).toBe("Bearer jeton-de-test");
    expect(entetes.get("accept")).toBe("application/vnd.github+json");
    expect(entetes.get("x-github-api-version")).toBe("2022-11-28");
    expect(entetes.get("user-agent")).toBeTruthy(); // exigé par l'API GitHub
  });

  it("accepte aussi 200 (réponse avec le détail du lancement)", async () => {
    const { f } = fauxFetch(new Response("{}", { status: 200 }));
    expect(await demanderPublication(config, f)).toEqual({ ok: true });
  });

  it("un refus de GitHub est rendu lisible, sans le jeton", async () => {
    const { f } = fauxFetch(new Response('{"message":"Bad credentials"}', { status: 401 }));
    const resultat = await demanderPublication(config, f);
    expect(resultat).toEqual({ ok: false, raison: "GitHub a refusé la demande (401)" });
    expect(JSON.stringify(resultat)).not.toContain("jeton-de-test");
  });

  it("GitHub injoignable : échec signalé, pas d'exception", async () => {
    const { f } = fauxFetch(new TypeError("fetch failed"));
    expect(await demanderPublication(config, f)).toEqual({ ok: false, raison: "GitHub est injoignable" });
  });
});

describe("lireDernierePublication", () => {
  const run = (status: string, conclusion: string | null) =>
    new Response(JSON.stringify({ workflow_runs: [{ status, conclusion, updated_at: "2026-11-11T10:42:00Z" }] }), { status: 200 });

  it("lit la dernière exécution du workflow sur la branche", async () => {
    const { f, appels } = fauxFetch(run("completed", "success"));
    expect(await lireDernierePublication(config, f)).toEqual({ etat: "faite", le: Date.parse("2026-11-11T10:42:00Z") });
    expect(appels[0].url).toBe("https://api.github.com/repos/Dylan-f1/Natur-Oce/actions/workflows/publier.yml/runs?branch=main&per_page=1");
    expect(appels[0].init.method ?? "GET").toBe("GET");
  });

  /** État lu, réduit à son nom (« inconnu » et null passent tels quels). */
  const etatDe = async (reponse: Response) => {
    const e = await lireDernierePublication(config, fauxFetch(reponse).f);
    return e === null || e === "inconnu" ? e : e.etat;
  };

  it("en file ou en cours → « en cours » ; terminée sans succès → « échouée »", async () => {
    for (const status of ["queued", "in_progress", "waiting", "requested", "pending"]) {
      expect(await etatDe(run(status, null)), status).toBe("en_cours");
    }
    for (const conclusion of ["failure", "cancelled", "timed_out"]) {
      expect(await etatDe(run("completed", conclusion)), conclusion).toBe("echouee");
    }
  });

  it("aucune exécution → null ; GitHub en erreur ou injoignable → « inconnu »", async () => {
    expect(await lireDernierePublication(config, fauxFetch(new Response('{"workflow_runs":[]}', { status: 200 })).f)).toBeNull();
    expect(await lireDernierePublication(config, fauxFetch(new Response("", { status: 500 })).f)).toBe("inconnu");
    expect(await lireDernierePublication(config, fauxFetch(new TypeError("fetch failed")).f)).toBe("inconnu");
  });
});
