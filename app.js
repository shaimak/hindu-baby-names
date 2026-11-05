import { zonedTimeToUTC, moonSidereal, reading, matchNames, buildNakIndex } from "./naming.js";

const $ = (s) => document.querySelector(s);
const out = $("#out");

const data = await Promise.all([
  fetch("data/names.json").then((r) => r.json()),
  fetch("data/sounds.json").then((r) => r.json()),
]).then(([names, sounds]) => ({ names, sounds, nakIdx: buildNakIndex(sounds) }))
  .catch(() => null);

if (!data) {
  out.innerHTML = '<p class="err">Could not load the name data.</p>';
} else {
  // city search -> timezone (city list lazy-loaded on first focus); default India (IST)
  const cityEl = $("#city"), sug = $("#suggest"), tznote = $("#tznote");
  let citiesArr = null, selectedTz = "Asia/Kolkata";
  const loadCities = async () => (citiesArr ||= await fetch("data/cities.json").then((r) => r.json()));
  cityEl.addEventListener("focus", loadCities, { once: true });
  const setCity = (r) => { cityEl.value = r[0]; selectedTz = r[3]; tznote.textContent = "Time zone: " + r[3] + " (" + [r[1], r[2]].filter(Boolean).join(", ") + ")"; sug.hidden = true; };
  cityEl.addEventListener("input", async () => {
    const q = cityEl.value.trim().toLowerCase();
    if (q.length < 2) { sug.hidden = true; return; }
    const list = (await loadCities()).filter((r) => r[0].toLowerCase().startsWith(q)).slice(0, 20);
    if (!list.length) { sug.hidden = true; return; }
    sug._list = list;
    sug.innerHTML = list.map((r, i) => `<div data-i="${i}">${esc(r[0])} <span class="ad">— ${esc([r[1], r[2]].filter(Boolean).join(" · "))}</span></div>`).join("");
    sug.hidden = false;
  });
  sug.addEventListener("mousedown", (e) => { const d = e.target.closest("div[data-i]"); if (d) setCity(sug._list[+d.dataset.i]); });
  cityEl.addEventListener("blur", () => setTimeout(() => (sug.hidden = true), 150));

  // pill groups -> remember selected value on the container
  for (const id of ["gender", "style"]) {
    const g = $("#" + id); g.dataset.v = g.querySelector('[aria-pressed="true"]').dataset.v;
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      g.dataset.v = b.dataset.v;
    });
  }

  $("#f").addEventListener("submit", (e) => {
    e.preventDefault();
    const [y, mo, d] = $("#date").value.split("-").map(Number);
    const [h, mi] = $("#time").value.split(":").map(Number);
    if (citiesArr) { const m = citiesArr.find((r) => r[0].toLowerCase() === cityEl.value.trim().toLowerCase()); if (m) selectedTz = m[3]; }
    const utc = zonedTimeToUTC(y, mo, d, h, mi, selectedTz);
    const r = reading(moonSidereal(utc), data.sounds);
    const style = $("#style").dataset.v;
    const { focused, broader } = matchNames(data.names, r, { gender: $("#gender").dataset.v, style }, data.nakIdx);
    render(r, focused, broader, style);
  });
}

const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const isModern = (n) => /\bmodern\b|no mw lemma/i.test(n.etymology || "");

function nameList(arr, empty) {
  if (!arr.length) return `<p class="muted">${empty || "No names in the current collection for this filter."}</p>`;
  return `<ul class="names">${arr.map((n) => `
    <li>
      <div class="nm">
        <span class="dev">${esc(n.devanagari)}</span>
        <span class="en">${esc(n.name)}</span>
        ${n.iast ? `<span class="ia">${esc(n.iast)}</span>` : ""}
        <span class="tag">${isModern(n) ? "modern" : "classical"}</span>
      </div>
      ${n.meaning ? `<div class="mn">${esc(n.meaning)}</div>` : ""}
    </li>`).join("")}</ul>`;
}

function render(r, focused, broader, style) {
  const sounds = r.rashi.sounds.map((s) => `<span>${esc(s.latin)}</span>`).join("");
  const filt = style && style !== "all";
  const hint = filt ? ` Set Style to “All” to see classical options.` : "";
  const emptyF = `No ${filt ? style + " " : ""}names starting with ${esc(r.padaSound.latin)} in the collection.${hint}`;
  const emptyB = `No ${filt ? style + " " : ""}names in ${esc(r.rashi.name)} rashi in the collection.${hint}`;
  out.innerHTML = `
    <div class="card">
      <div class="big">${esc(r.nakshatra.name)} <span class="dev">${esc(r.padaSound.dev || "")}</span> · ${esc(r.rashi.name)}</div>
      <div class="muted">Nakshatra ${r.nakIndex + 1} of 27 · pada ${r.pada}${r.nakshatra.deity ? " · deity " + esc(r.nakshatra.deity) : ""}</div>
      <div style="margin-top:10px"><strong>Starting sound:</strong> ${esc(r.padaSound.latin)} ${esc(r.padaSound.dev || "")}</div>
      <div class="muted" style="margin-top:8px">Rashi (${esc(r.rashi.name)}) sounds:</div>
      <div class="sounds">${sounds}</div>
      ${r.nearBoundary ? `<div class="warn">The Moon is within half a degree of a pada boundary — a small change in the recorded birth time could change the reading.</div>` : ""}
    </div>
    <h2>Focused — ${esc(r.nakshatra.name)} pada ${r.pada} <span class="count">(${focused.length})</span></h2>
    ${nameList(focused, emptyF)}
    <h2>Broader — ${esc(r.rashi.name)} rashi <span class="count">(${broader.length})</span></h2>
    ${nameList(broader, emptyB)}`;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
