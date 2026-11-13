import { describe, expect, it } from "vitest";
import { echapperIcs, fichierAgenda, parisVersUtc } from "@/lib/email/agenda";

// Fichier d'agenda joint à la demande de séance (13/11).

describe("parisVersUtc", () => {
  it("heure d'hiver (+1 h) et d'été (+2 h)", () => {
    expect(new Date(parisVersUtc("2026-11-18", "18:30")).toISOString()).toBe("2026-11-18T17:30:00.000Z");
    expect(new Date(parisVersUtc("2027-06-15", "09:00")).toISOString()).toBe("2027-06-15T07:00:00.000Z");
  });

  it("le jour du changement d'heure (28 mars 2027)", () => {
    expect(new Date(parisVersUtc("2027-03-28", "10:00")).toISOString()).toBe("2027-03-28T08:00:00.000Z");
  });
});

describe("fichierAgenda", () => {
  const ics = fichierAgenda({
    jour: "2026-11-18", heure: "18:30", dureeMinutes: 60, titre: "Séance avec Léa (à confirmer)",
    description: "Ligne 1\nVirgule, point-virgule; fin", uid: "abc", maintenant: Date.UTC(2026, 10, 12, 9, 0, 0),
  });

  it("événement complet, fins de ligne CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("\r\nDTSTART:20261118T173000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261118T183000Z\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261112T090000Z\r\n");
    expect(ics).toContain("UID:abc@natur-oce.fr");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("texte échappé et lignes repliées à 75 octets", () => {
    expect(echapperIcs("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    for (const ligne of ics.split("\r\n")) expect(new TextEncoder().encode(ligne).length).toBeLessThanOrEqual(75);
  });
});
