// Self-check: validate the shared calc against the two known TaraGrid readings, plus data sanity.
import { readFileSync } from "node:fs";
import assert from "node:assert";
import { zonedTimeToUTC, moonSidereal, reading, matchNames, buildNakIndex } from "../naming.js";

const d = (f) => JSON.parse(readFileSync(new URL("../data/" + f, import.meta.url)));
const sounds = d("sounds.json");
const names = d("names.json");
const nakIdx = buildNakIndex(sounds);

let fail = 0;
const check = (label, got, want, tol = 0.01) => {
  const ok = typeof want === "number" ? Math.abs(got - want) <= tol : got === want;
  console.log((ok ? "ok  " : "FAIL") + "  " + label + " = " + got + (ok ? "" : "  (want " + want + ")"));
  if (!ok) fail++;
};

// zone conversion (IST, no DST)
check("IST 2026-10-05 07:17 -> UTC ms", zonedTimeToUTC(2026, 10, 5, 7, 17, "Asia/Kolkata"), Date.UTC(2026, 9, 5, 1, 47), 0);
// a DST zone, for the two-pass offset logic
check("NY 2021-07-01 12:00 -> UTC ms", zonedTimeToUTC(2021, 7, 1, 12, 0, "America/New_York"), Date.UTC(2021, 6, 1, 16, 0), 0);

// TaraGrid case A: 22 Jul 2025 18:45 New Delhi -> Mrigashira pada 4, Kee, Mithuna
const a = reading(moonSidereal(zonedTimeToUTC(2025, 7, 22, 18, 45, "Asia/Kolkata")), sounds);
check("A longitude", a.longitude, 66.2715, 0.01);
check("A nakshatra", a.nakshatra.name, "Mrigashira");
check("A pada", a.pada, 4);
check("A sound", a.padaSound.latin, "Kee");
check("A rashi", a.rashi.name, "Mithuna");

// TaraGrid case B: 5 Oct 2026 07:17 Hyderabad -> Pushya pada 2, He, Karka
const b = reading(moonSidereal(zonedTimeToUTC(2026, 10, 5, 7, 17, "Asia/Kolkata")), sounds);
check("B longitude", b.longitude, 97.4489, 0.01);
check("B nakshatra", b.nakshatra.name, "Pushya");
check("B pada", b.pada, 2);
check("B sound", b.padaSound.latin, "He");
check("B rashi", b.rashi.name, "Karka");

// name matching: Hemant is a Pushya pada 2 boy name -> must appear in case B focused list
const mB = matchNames(names, b, { gender: "boy" }, nakIdx);
check("B focused has Hemant", mB.focused.some((n) => n.slug === "hemant"), true);
check("B focused all Pushya/2", mB.focused.every((n) => n.nakshatra === "Pushya" && n.pada === 2), true);
console.log(`B lists: focused ${mB.focused.length}, broader ${mB.broader.length}`);

// every name's nakshatra must resolve to our table (else it silently never appears)
const unresolved = names.filter((n) => nakIdx[n.nakshatra.toLowerCase().replace(/\s+/g, "")] == null);
check("all names map to a nakshatra", unresolved.length, 0, 0);
if (unresolved.length) console.log("  unresolved:", [...new Set(unresolved.map((n) => n.nakshatra))]);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
