// Fichier d'agenda (.ics, RFC 5545) joint à la demande de séance : Océane l'ouvre pour ajouter le
// créneau à son calendrier. Logique pure, testée dans tests/unit/agenda.test.ts.

/** Décalage de Paris par rapport à UTC (en minutes) à un instant donné : +60 l'hiver, +120 l'été. */
function decalageParis(instant: number): number {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parties.year, +parties.month - 1, +parties.day, +parties.hour, +parties.minute, +parties.second);
  return Math.round((local - instant) / 60_000);
}

/** « 2026-11-18 » + « 18:30 », heure de Paris → instant UTC (ms). */
export function parisVersUtc(jour: string, heure: string): number {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, mn] = heure.split(":").map(Number);
  const naif = Date.UTC(a, m - 1, j, h, mn);
  // Deux passes : le décalage dépend de l'instant cherché (changement d'heure).
  let instant = naif - decalageParis(naif) * 60_000;
  instant = naif - decalageParis(instant) * 60_000;
  return instant;
}

const horodatage = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Texte d'une propriété iCalendar : barre oblique inverse, point-virgule, virgule et retours échappés. */
export function echapperIcs(texte: string): string {
  return texte.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lignes de plus de 75 octets repliées (RFC 5545, 3.1). */
function replier(ligne: string): string {
  const octets = new TextEncoder();
  const morceaux: string[] = [];
  let courant = "";
  for (const c of ligne) {
    if (octets.encode(courant + c).length > (morceaux.length ? 74 : 75)) {
      morceaux.push(courant);
      courant = c;
    } else courant += c;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

export type Rendezvous = { jour: string; heure: string; dureeMinutes: number; titre: string; description: string; uid: string; maintenant?: number; lieu?: string; url?: string };

export function fichierAgenda(r: Rendezvous): string {
  const debut = parisVersUtc(r.jour, r.heure);
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Natur'Oce//Site//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.uid}@natur-oce.fr`,
    `DTSTAMP:${horodatage(r.maintenant ?? Date.now())}`,
    `DTSTART:${horodatage(debut)}`,
    `DTEND:${horodatage(debut + r.dureeMinutes * 60_000)}`,
    `SUMMARY:${echapperIcs(r.titre)}`,
    `DESCRIPTION:${echapperIcs(r.description)}`,
    ...(r.lieu ? [`LOCATION:${echapperIcs(r.lieu)}`] : []),
    ...(r.url ? [`URL:${r.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.map(replier).join("\r\n") + "\r\n";
}
