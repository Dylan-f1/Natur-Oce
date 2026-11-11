import { describe, expect, it } from "vitest";
import { empreinte } from "@/lib/empreinte";

const SECRET = "secret-de-test-de-plus-de-32-caracteres-0123";

describe("empreinte HMAC (aucune IP retrouvable sans la clé)", () => {
  it("est stable pour une même valeur et une même clé", async () => {
    expect(await empreinte("lien-ip:86.75.30.9", SECRET)).toBe(await empreinte("lien-ip:86.75.30.9", SECRET));
  });

  it("donne 64 caractères hexadécimaux, sans l'IP en clair", async () => {
    const e = await empreinte("lien-ip:86.75.30.9", SECRET);
    expect(e).toMatch(/^[0-9a-f]{64}$/);
    expect(e).not.toContain("86.75");
  });

  it("change avec la clé : sans la clé du site, on ne peut pas refaire le calcul", async () => {
    const autre = "autre-secret-de-plus-de-32-caracteres-9876543";
    expect(await empreinte("lien-ip:86.75.30.9", SECRET)).not.toBe(await empreinte("lien-ip:86.75.30.9", autre));
  });

  it("diffère d'un SHA-256 simple (qu'on pourrait recalculer pour toutes les IPv4)", async () => {
    const brut = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lien-ip:86.75.30.9"));
    const hexBrut = [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, "0")).join("");
    expect(await empreinte("lien-ip:86.75.30.9", SECRET)).not.toBe(hexBrut);
  });

  it.each(["", "trop-court"])("refuse un secret absent ou trop court (« %s »)", async (secret) => {
    await expect(empreinte("x", secret)).rejects.toThrow(/Secret/);
  });
});
