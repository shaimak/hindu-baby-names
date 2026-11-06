import { zonedTimeToUTC, moonSidereal, reading, matchNames, buildNakIndex, isModern } from "./naming.js";

const $ = (s) => document.querySelector(s);
const out = $("#out");
const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const data = await Promise.all([
  fetch("data/names.json").then((r) => r.json()),
  fetch("data/sounds.json").then((r) => r.json()),
]).then(([names, sounds]) => ({ names, sounds, nakIdx: buildNakIndex(sounds) }))
  .catch(() => null);

if (!data) {
  out.hidden = false;
  out.innerHTML = '<p class="err">Could not load the name data.</p>';
} else {
  // --- steps ---
  const stepEls = [...document.querySelectorAll(".step")];
  function showStep(n) {
    stepEls.forEach((s) => (s.hidden = +s.dataset.step !== n));
    $("#f").hidden = n === 3;
    out.hidden = n !== 3;
    document.querySelectorAll("#steps li").forEach((li) => li.setAttribute("aria-current", +li.dataset.step === n ? "true" : "false"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#toStep2").addEventListener("click", () => { if (!$("#date").value || !$("#time").value) return $("#f").reportValidity(); showStep(2); });
  $("#backTo1").addEventListener("click", () => showStep(1));

  // --- pill groups (single or multi) ---
  for (const id of ["gender", "style", "familiarity"]) {
    const g = $("#" + id), multi = g.dataset.mode === "multi";
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (multi) b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
      else g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    });
  }
  const pills = (id) => [...document.querySelectorAll("#" + id + ' button[aria-pressed="true"]')].map((b) => b.dataset.v);

  // --- city search -> timezone (lazy-loaded on first focus); default India (IST) ---
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

  // --- compute ---
  $("#f").addEventListener("submit", (e) => {
    e.preventDefault();
    const [y, mo, d] = $("#date").value.split("-").map(Number);
    const [h, mi] = $("#time").value.split(":").map(Number);
    if (citiesArr) { const m = citiesArr.find((r) => r[0].toLowerCase() === cityEl.value.trim().toLowerCase()); if (m) selectedTz = m[3]; }
    const r = reading(moonSidereal(zonedTimeToUTC(y, mo, d, h, mi, selectedTz)), data.sounds);
    const styles = pills("style");
    const { focused, broader } = matchNames(data.names, r, { gender: pills("gender")[0] || "both", styles }, data.nakIdx);
    render(r, focused, broader, styles, showStep);
    showStep(3);
  });

  showStep(1);
}

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

function render(r, focused, broader, styles, showStep) {
  const real = styles.filter((s) => s === "modern" || s === "traditional");
  const filt = real.length > 0 ? real.join("/") + " " : "";
  const emptyF = `No names starting with ${esc(r.padaSound.latin)} in the collection yet.`;
  const emptyB = `No other ${filt}names in ${esc(r.rashi.name)} rashi in the collection.`;
  const sounds = r.rashi.sounds.map((s) => `<span class="${s.latin === r.padaSound.latin ? "hit" : ""}">${esc(s.latin)}</span>`).join("");
  out.innerHTML = `
    <div class="editbar"><button type="button" class="back" id="edit">← Edit details</button></div>
    <div class="card">
      <div class="big">${esc(r.nakshatra.name)} <span class="dev">${esc(r.padaSound.dev || "")}</span> · ${esc(r.rashi.name)}</div>
      <div class="muted">Nakshatra ${r.nakIndex + 1} of 27 · pada ${r.pada}${r.nakshatra.deity ? " · deity " + esc(r.nakshatra.deity) : ""}</div>
      <div style="margin-top:10px"><strong>Starting sound:</strong> ${esc(r.padaSound.latin)} <span class="dev">${esc(r.padaSound.dev || "")}</span></div>
      <div class="muted" style="margin-top:8px">Rashi (${esc(r.rashi.name)}) sounds — the focused one is highlighted:</div>
      <div class="sounds">${sounds}</div>
      ${r.nearBoundary ? `<div class="warn">The Moon is within half a degree of a pada boundary — a small change in the recorded birth time could change the reading.</div>` : ""}
    </div>
    <h2>Your sound — ${esc(r.padaSound.latin)} <span class="dev">${esc(r.padaSound.dev || "")}</span> <span class="count">(${focused.length})</span></h2>
    <p class="muted" style="margin:0">${esc(r.nakshatra.name)} pada ${r.pada} — every matching name, modern and classical.</p>
    ${nameList(focused, emptyF)}
    <h2>More in your rashi — ${esc(r.rashi.name)} <span class="count">(${broader.length})</span></h2>
    <p class="muted" style="margin:0">Other sounds in the same rashi${filt ? " · " + esc(filt.trim()) + " only" : ""}.</p>
    ${nameList(broader, emptyB)}`;
  $("#edit").addEventListener("click", () => showStep(1));
}
