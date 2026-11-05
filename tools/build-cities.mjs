// Build data/cities.json from GeoNames cities15000: [name, admin1, country, timezone], by population desc.
import { readFileSync, writeFileSync } from "node:fs";
const DIR = "/tmp/claude-1000/-home-shaimak--config-Claude-scratch-workspaces-3842f5f5-7b01-46b2-b006-5a225bf378c3-ff41118b-9806-45c9-bd06-f1de5deffc95-scratch-2026-11-05-fd8043/4456636a-5a89-4d0b-95e2-f0f766343a1d/scratchpad/geonames/";
const lines = (f) => readFileSync(DIR + f, "utf8").split("\n").filter(Boolean);

const country = {}; // ISO -> name
for (const l of lines("countryInfo.txt")) { if (l[0] === "#") continue; const c = l.split("\t"); country[c[0]] = c[4]; }
const admin1 = {}; // "CC.code" -> name
for (const l of lines("admin1CodesASCII.txt")) { const c = l.split("\t"); admin1[c[0]] = c[1]; }

const rows = lines("cities15000.txt").map((l) => {
  const c = l.split("\t");
  return { name: c[1], admin1: admin1[c[8] + "." + c[10]] || "", country: country[c[8]] || c[8], tz: c[17], pop: +c[14] || 0 };
}).filter((r) => r.tz)
  .sort((a, b) => b.pop - a.pop)
  .map((r) => [r.name, r.admin1, r.country, r.tz]);

writeFileSync(new URL("../data/cities.json", import.meta.url).pathname, JSON.stringify(rows));
console.log("cities:", rows.length);
const find = (n) => rows.find((r) => r[0] === n);
console.log("Hyderabad:", JSON.stringify(find("Hyderabad")));
console.log("New Delhi:", JSON.stringify(find("New Delhi")));
console.log("London:", JSON.stringify(find("London")));
