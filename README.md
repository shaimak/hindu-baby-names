# babynames.shaimakreddy.com

A free baby-name finder based on the Vedic **nakshatra / pada / rashi** naming tradition.
Enter the birth date, time and time zone; it computes the Moon's sidereal position and
shows every matching name with its meaning. No accounts, no paywall, no backend —
the whole calculation runs in the browser and the site is static.

## How it works

1. Local birth time + IANA time zone → UTC (browser's own tz database, DST included).
2. Moon's ecliptic longitude via [astronomy-engine](https://github.com/cosinekitty/astronomy),
   minus the **Lahiri ayanamsa** (a quadratic fit to Swiss Ephemeris, max error ~19″ over
   1950–2050) → sidereal longitude.
3. `nakshatra = ⌊lon / 13°20′⌋`, `pada = ⌊(lon mod 13°20′) / 3°20′⌋`, `rashi = ⌊lon / 30°⌋`.
4. Names are matched to the reading by their own nakshatra + pada (focused list) and rashi
   (broader list), filtered by gender and style.

Validated against two independent readings to 0.0002° (see `tools/test.mjs`).

## Files

| Path | What |
|---|---|
| `index.html`, `app.js` | the page and its UI |
| `naming.js` | pure calculation + matching (shared by app and test) |
| `lib/astronomy.js` | vendored astronomy-engine (ESM) |
| `data/names.json` | name dataset (name, Devanagari, meaning, nakshatra, pada, gender) |
| `data/sounds.json` | nakshatra/pada and rashi sound tables |
| `tools/scrape.mjs` | builds the local offline archive + dataset |
| `tools/build-tables.mjs` | builds `sounds.json` |
| `tools/test.mjs` | self-check (`node tools/test.mjs`) |

## Data provenance

Name entries and the sound tables were compiled from the public reference pages of
taragrid.com, whose meanings trace to the public-domain Monier-Williams Sanskrit
dictionary (1899) and cited classical texts. Only the factual dataset is published here;
the raw page archive is kept locally (`data/raw/`, git-ignored) and not redistributed.
This is traditional naming guidance, not a prediction.

## Deploy

Static site served by GitHub Pages from `main` (root). Custom domain in `CNAME`.
Rebuild data with `node tools/scrape.mjs && node tools/build-tables.mjs && node tools/test.mjs`.
