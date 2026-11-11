import { describe, expect, it } from "vitest";
import { estAutorisee, normaliserAdresse, origineDeConfiance } from "@/lib/auth/regles";

describe("estAutorisee (seule Océane reçoit un lien)", () => {
  const admin = "oceane@exemple.test";

  it("ignore la casse et les espaces", () => {
    expect(estAutorisee("  Oceane@Exemple.TEST ", admin)).toBe(true);
    expect(normaliserAdresse(" A@B.fr ")).toBe("a@b.fr");
  });

  it.each(["autre@exemple.test", "oceane@exemple.test.pirate.fr", "oceane@exemple", ""])("refuse « %s »", (a) => {
    expect(estAutorisee(a, admin)).toBe(false);
  });

  it("refuse tout le monde si ADMIN_EMAIL manque", () => {
    expect(estAutorisee(admin, undefined)).toBe(false);
    expect(estAutorisee(admin, "")).toBe(false);
  });
});

describe("origineDeConfiance (liens de connexion jamais vers un autre domaine)", () => {
  it.each([
    ["natur-oce.fr", "https", "https://natur-oce.fr"],
    ["127.0.0.1:8791", null, "http://127.0.0.1:8791"],
    ["localhost:3000", "https", "http://localhost:3000"],
    ["natur-oce.exemple.workers.dev", "https", "https://natur-oce.exemple.workers.dev"],
  ])("Host %s → %s", (host, proto, attendu) => {
    expect(origineDeConfiance(host, proto)).toBe(attendu);
  });

  it.each([
    ["pirate.example", "https"],
    ["natur-oce.fr.pirate.example", "https"],
    ["natur-oce.fr", "http"],
    ["127.0.0.1:8791@pirate.example", null],
    ["autre-site.exemple.workers.dev", "https"],
    ["natur-oce.exemple.workers.dev", "http"],
    ["natur-oce.workers.dev.pirate.example", "https"],
    [null, null],
  ])("Host forgé %s → production", (host, proto) => {
    expect(origineDeConfiance(host, proto)).toBe("https://natur-oce.fr");
  });
});
