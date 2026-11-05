// Build authoritative sound tables from the scraped nakshatra/rashi pages,
// so our sidereal-longitude -> sound mapping matches TaraGrid exactly.
import { readFileSync, writeFileSync } from "node:fs";
const RAW = new URL("../data/raw/", import.meta.url).pathname;

const NAK = ["ashwini","bharani","krittika","rohini","mrigashira","ardra","punarvasu","pushya","ashlesha","magha","purva-phalguni","uttara-phalguni","hasta","chitra","swati","vishakha","anuradha","jyeshtha","mula","purva-ashadha","uttara-ashadha","shravana","dhanishtha","shatabhisha","purva-bhadrapada","uttara-bhadrapada","revati"];
const RASHI = ["mesha","vrishabha","mithuna","karka","simha","kanya","tula","vrischika","dhanu","makara","kumbha","meena"];
const title = (s) => s.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");
const clean = (f) => readFileSync(RAW+f,"utf8").replace(/<script[\s\S]*?<\/script>/g," ").replace(/<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&#x27;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
// (devanagari, latin-sound) pairs; latin sound may be a single vowel like "A"
const pairs = (s) => [...s.matchAll(/([ऀ-ॿ]+)\s+([A-Z][a-zü]*)\b/g)].map(m=>({dev:m[1],latin:m[2]}));
const cut = (s) => s.split(/Girl names|Boy names|Names for/i)[0];

const nakshatras = NAK.map((slug,i)=>{
  const t = clean(`nakshatra/${slug}.html`);
  const seg = t.split(/padas and their starting sounds/i)[1] || "";
  const padas = pairs(cut(seg)).slice(0,4);
  const deity = /presiding deity is ([A-Za-zāīūṛṁṣṇśḥ]+)/.exec(t)?.[1] || null;
  const planet = /ruling planet is ([A-Za-z]+)/.exec(t)?.[1] || null;
  const rashi = /padas fall in the ([A-Za-z]+) rashi/.exec(t)?.[1] || null;
  if (padas.length !== 4) console.error("WARN", slug, "padas:", padas.length, padas.map(p=>p.latin));
  return { index:i, slug, name:title(slug), deity, planet, rashi, padas };
});

const rashis = RASHI.map((slug,i)=>{
  const t = clean(`rashi/${slug}.html`);
  const parts = t.split(/traditional starting sounds/i);
  // several parts mention the phrase (intro + FAQ echo); keep the one with the most Devanagari pairs
  const sounds = parts.map(p => pairs(cut(p))).reduce((best, c) => c.length > best.length ? c : best, []);
  if (sounds.length < 7) console.error("WARN rashi", slug, "sounds:", sounds.length);
  return { index:i, slug, name:title(slug), sounds };
});

writeFileSync(new URL("../data/sounds.json", import.meta.url).pathname, JSON.stringify({nakshatras,rashis},null,2));
console.log("nakshatras:",nakshatras.length,"rashis:",rashis.length);
console.log("Krittika padas:", nakshatras[2].padas.map(p=>p.latin).join(" "));
console.log("Rohini padas:", nakshatras[3].padas.map(p=>p.latin).join(" "));
console.log("Pushya padas:", nakshatras[7].padas.map(p=>p.latin).join(" "), "| rashi", nakshatras[7].rashi);
console.log("Karka sounds:", rashis[3].sounds.map(s=>s.latin).join(" "));
console.log("Mithuna sounds:", rashis[2].sounds.map(s=>s.latin).join(" "));
