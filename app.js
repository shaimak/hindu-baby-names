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
  // time-zone dropdown, default IST
  const tz = $("#tz");
  const zones = (Intl.supportedValuesOf?.("timeZone")) || ["Asia/Kolkata", "UTC"];
  const india = zones.includes("Asia/Kolkata") ? "Asia/Kolkata" : "Asia/Calcutta"; // ICU alias varies by engine
  tz.innerHTML = zones.map((z) => `<option${z === india ? " selected" : ""}>${z}</option>`).join("");

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
    const utc = zonedTimeToUTC(y, mo, d, h, mi, tz.value);
    const r = reading(moonSidereal(utc), data.sounds);
    const { focused, broader } = matchNames(data.names, r, { gender: $("#gender").dataset.v, style: $("#style").dataset.v }, data.nakIdx);
    render(r, focused, broader);
  });
}

const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const isModern = (n) => /\bmodern\b|no mw lemma/i.test(n.etymology || "");

function nameList(arr) {
  if (!arr.length) return '<p class="muted">No names in the current collection for this filter.</p>';
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

function render(r, focused, broader) {
  const sounds = r.rashi.sounds.map((s) => `<span>${esc(s.latin)}</span>`).join("");
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
    ${nameList(focused)}
    <h2>Broader — ${esc(r.rashi.name)} rashi <span class="count">(${broader.length})</span></h2>
    ${nameList(broader)}`;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
