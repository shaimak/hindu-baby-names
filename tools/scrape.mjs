// Scrape taragrid.com public pages: save raw HTML offline + parse /names/* into a dataset.
// Facts only (name, devanagari, meaning, sound/nakshatra/pada); raw kept so we can re-parse.
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const BASE = "https://taragrid.com";
const OUT = new URL("../data/", import.meta.url).pathname;
const UA = "babynames-archiver/1.0 (personal project)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { "User-Agent": UA } });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch {}
    await sleep(500 * (i + 1));
  }
  return null;
}

const clean = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ").trim();

function parseName(slug, html) {
  const t = clean(html);
  const seg = t.split("Names / ")[1] || t;
  const dev = (seg.match(/[ऀ-ॿ]+/) || [])[0] || null;
  const meaning = (seg.match(/[“"]\s*(.*?)\s*[”"]/) || [])[1] || null;
  const iast = dev ? ((seg.split(dev)[1] || "").trim().split("·")[0].trim() || null) : null;
  const gender = /traditionally used for (boys|girls|all|any)/i.exec(seg)?.[1]?.toLowerCase() || null;
  const etym = (seg.split(/[”"]/)[1] || "").split("Starting sound")[0].trim() || null;
  const sound = /begins with ([A-Za-z]+)\s*[—-]/.exec(seg)?.[1] || null;
  const np = /open ([A-Za-z][A-Za-z ]*?) pada (\d)/i.exec(seg);
  return {
    slug, name: slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" "),
    devanagari: dev, iast, gender,
    meaning, etymology: etym && etym.length < 400 ? etym : null,
    sound, nakshatra: np?.[1]?.trim() || null, pada: np ? +np[2] : null,
    sourceUrl: BASE + "/names/" + slug,
  };
}

async function save(path, body) {
  const f = OUT + "raw" + (path === "/" ? "/index" : path) + ".html";
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, body);
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k]); await sleep(120); }
  }));
}

const sm = await get("/sitemap.xml");
const urls = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(BASE, "") || "/");
console.log("sitemap urls:", urls.length);

let done = 0;
const names = [];
await pool(urls, 5, async (path) => {
  const html = await get(path);
  if (!html) { console.log("MISS", path); return; }
  await save(path, html);
  if (path.startsWith("/names/")) names.push(parseName(path.slice(7), html));
  if (++done % 50 === 0) console.log("fetched", done, "/", urls.length);
});

names.sort((a, b) => a.slug.localeCompare(b.slug));
await writeFile(OUT + "names.json", JSON.stringify(names, null, 2));
await writeFile(OUT + "sitemap-urls.json", JSON.stringify(urls, null, 2));

const miss = (k) => names.filter((n) => !n[k]).length;
console.log("DONE. raw pages:", done, "| names parsed:", names.length);
console.log("missing: meaning", miss("meaning"), "sound", miss("sound"), "nakshatra", miss("nakshatra"), "devanagari", miss("devanagari"), "gender", miss("gender"));
