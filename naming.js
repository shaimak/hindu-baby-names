// Pure nakshatra/rashi naming logic. No DOM, no I/O — data is passed in.
// Shared by the browser app (app.js) and the node test (tools/test.mjs).
import * as Astronomy from "./lib/astronomy.js";

// Lahiri ayanamsa (deg), quadratic fit to Swiss Ephemeris, max error ~19" over 1950-2050.
// T = Julian centuries from J2000. See tools/calibrate notes.
const AYAN = [23.85688096, 1.39672496, 0.0070491575];
const ayanamsa = (jdUT) => { const t = (jdUT - 2451545.0) / 36525.0; return AYAN[0] + AYAN[1] * t + AYAN[2] * t * t; };

const NAK_SPAN = 360 / 27;   // 13°20'
const PADA_SPAN = 360 / 108; // 3°20'

// Local wall-clock time in an IANA zone -> UTC epoch ms, using the browser/node's own tz database (DST included).
export function zonedTimeToUTC(y, mo, d, h, mi, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  // offset can shift across a DST edge, so resolve twice
  let utc = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(dtf.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
    const asZone = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    utc -= asZone - Date.UTC(y, mo - 1, d, h, mi, 0);
  }
  return utc;
}

// Sidereal (Lahiri) Moon longitude in degrees [0,360) for a UTC epoch ms.
export function moonSidereal(utcMs) {
  const time = Astronomy.MakeTime(new Date(utcMs));
  const elon = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, time, true)).elon;
  const jdUT = 2451545.0 + time.ut;
  return ((elon - ayanamsa(jdUT)) % 360 + 360) % 360;
}

// longitude -> nakshatra/pada/rashi + sounds, given sounds.json.
export function reading(longitude, sounds) {
  const nakIndex = Math.floor(longitude / NAK_SPAN);
  const padaIndex = Math.floor((longitude % NAK_SPAN) / PADA_SPAN);
  const rashiIndex = Math.floor(longitude / 30);
  const nak = sounds.nakshatras[nakIndex];
  const edge = longitude % PADA_SPAN;
  return {
    longitude, nakIndex, padaIndex, rashiIndex,
    nakshatra: nak, pada: padaIndex + 1, padaSound: nak.padas[padaIndex],
    rashi: sounds.rashis[rashiIndex],
    nearBoundary: Math.min(edge, PADA_SPAN - edge) < 0.5,
  };
}

// Each name carries its own nakshatra+pada (scraped). Derive its rashi the same way a longitude would.
function nameRashiIndex(n, nakIndexByName) {
  const ni = nakIndexByName[norm(n.nakshatra)];
  if (ni == null || !n.pada) return null;
  return Math.floor((ni * 4 + (n.pada - 1)) / 9); // 9 padas per rashi
}
const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");

export function buildNakIndex(sounds) {
  return Object.fromEntries(sounds.nakshatras.map((n) => [norm(n.name), n.index]));
}

export const isModern = (n) => /\bmodern\b|no mw lemma/i.test(n.etymology || "");

// Split names into the focused (nakshatra+pada) and broader (rashi) lists, filtered by gender/style.
// styles: array of selected style keys. Only "modern"/"traditional" are data-backed; others are UI-only.
export function matchNames(names, r, { gender = "both", styles = [] } = {}, nakIndexByName) {
  const genderOk = (n) => gender === "both" || !n.gender || n.gender === (gender === "boy" ? "boys" : "girls");
  const real = styles.filter((s) => s === "modern" || s === "traditional");
  const styleOk = (n) => real.length === 0 || real.some((s) => (s === "modern") === isModern(n));
  const ok = (n) => genderOk(n) && styleOk(n);

  const focused = names.filter((n) => norm(n.nakshatra) === norm(r.nakshatra.name) && n.pada === r.pada && ok(n));
  const focusedSlugs = new Set(focused.map((n) => n.slug));
  const broader = names.filter((n) => nameRashiIndex(n, nakIndexByName) === r.rashiIndex && ok(n) && !focusedSlugs.has(n.slug));
  return { focused, broader };
}
