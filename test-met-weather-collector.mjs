import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceRegistry } from "./source-registry.js";
import { ServerCollector, parseMetForecastHtml, parseMetTideHtml } from "./server-collector.js";

const forecastUrl = "https://meteorology.gov.mv/forecast";
const tideUrl = "https://meteorology.gov.mv/?pd=home";

const stationCards = ["Tomorrow", "Next 48 hrs", "Next 72 hrs"].map((period, periodIndex) => `
  <h3>${period}</h3>
  ${["Hulhule", "Hanimaadhoo", "Kadhdhoo", "Kaadehdhoo", "Gan"].map((station, stationIndex) => `
    <div>${station}</div><div>${30 - periodIndex}°C</div><div>${periodIndex === 0 ? "Thundershowers" : "Moderate Rain"}</div>
  `).join("")}
`).join("");

const forecastHtml = `<!doctype html><html><body>
  <h1>Forecast</h1>
  ${stationCards}
  <h2>General Forecast</h2>
  <div>Valid from 9th August 2026 / 10:00 am — 10th August 2026 / 10:00 am</div>
  <h4>Weather</h4><p>Showers expected in isolated places with a few thunderstorms.</p>
  <h4>Winds</h4><p>West/northwesterly at 8 – 18 miles per hour.</p>
  <h4>Seas</h4><p>Moderate.</p>
  <h4>Wave Height</h4><p>2 – 5 feet.</p>
  <div>Advisory: Swell wave surges are possible during high tides.</div>
  <h2>Marine Forecast</h2>
  <div>Valid from 9th August 2026 / 10:00 am — 10th August 2026 / 10:00 am</div>
  <h4>Weather</h4><p>Showers expected in isolated places.</p>
  <h4>Winds</h4><p>West/northwesterly at 7 - 16 knots.</p>
  <h4>Seas</h4><p>Moderate.</p>
  <h4>Wave Height</h4><p>2 – 5 feet.</p>
</body></html>`;

const parsedForecast = parseMetForecastHtml(forecastHtml);
assert.ok(parsedForecast);
assert.equal(parsedForecast.edition, "day");
assert.equal(parsedForecast.validFrom, "2026-08-09T10:00:00+05:00");
assert.equal(parsedForecast.validTo, "2026-08-10T10:00:00+05:00");
assert.equal(parsedForecast.general.waveHeight, "2 – 5 feet.");
assert.equal(parsedForecast.marine.winds, "West/northwesterly at 7 - 16 knots.");
assert.ok(parsedForecast.general.advisory.includes("Swell wave surges"));
assert.equal(parsedForecast.stationOutlook.length, 15);
assert.ok(parsedForecast.body.includes("Marine Forecast"));

// Real MMS markup can expose an early General/Marine tab pair before the actual
// content sections. The parser must choose the contentful headings, not the first labels.
const duplicatedHeadingHtml = forecastHtml.replace(
  '<h1>Forecast</h1>',
  '<h1>Forecast</h1><div>General Forecast</div><div>Marine Forecast</div>'
);
const duplicatedHeadingForecast = parseMetForecastHtml(duplicatedHeadingHtml);
assert.ok(duplicatedHeadingForecast);
assert.equal(duplicatedHeadingForecast.general.weather, "Showers expected in isolated places with a few thunderstorms.");
assert.equal(duplicatedHeadingForecast.general.waveHeight, "2 – 5 feet.");
assert.equal(duplicatedHeadingForecast.marine.waveHeight, "2 – 5 feet.");
assert.equal(duplicatedHeadingForecast.stationOutlook.length, 15);

// Station cards can collapse temperature and condition into a single visible-text line.
const inlineStationHtml = forecastHtml.replace(/<div>(\d+°C)<\/div><div>(Thundershowers|Moderate Rain)<\/div>/g, '<div>$1 $2</div>');
const inlineStationForecast = parseMetForecastHtml(inlineStationHtml);
assert.ok(inlineStationForecast);
assert.equal(inlineStationForecast.stationOutlook.length, 15);
assert.equal(inlineStationForecast.stationOutlook[0].temperature, "30°C");
assert.equal(inlineStationForecast.stationOutlook[0].condition, "Thundershowers");

const nightForecast = parseMetForecastHtml(forecastHtml.replace(/10:00 am/g, "08:00 pm"));
assert.equal(nightForecast.edition, "night");

const tideHtml = `<!doctype html><html><body>
  <h3>Tide prediction chart</h3>
  <div>Hulhule</div><div>Hanimaadhoo</div><div>Gan</div>
  <div>Sunday, Aug 9</div>
  <h3>Moon phases</h3>
  <script type="application/json">{
    "tides": {
      "Hulhule": [
        {"time":"01:15","height":0.42,"type":"Low"},
        {"time":"07:35","height":0.91,"type":"High"}
      ],
      "Hanimaadhoo": [
        {"time":"01:30","height":0.38,"type":"Low"},
        {"time":"07:50","height":0.88,"type":"High"}
      ],
      "Gan": [
        {"time":"02:00","height":0.35,"type":"Low"},
        {"time":"08:10","height":0.82,"type":"High"}
      ]
    }
  }</script>
</body></html>`;

const parsedTide = parseMetTideHtml(tideHtml);
assert.ok(parsedTide);
assert.equal(parsedTide.usable, true);
assert.equal(parsedTide.points.length, 6);
assert.equal(parsedTide.points.filter((p) => p.station === "Hulhule").length, 2);
assert.ok(parsedTide.body.includes("Hanimaadhoo"));
assert.ok(parsedTide.publishedAt.startsWith("2026-08-09T00:00:00"));

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-met-weather-test-"));
const registry = new SourceRegistry({ storePath: path.join(tempDir, "sources.json") });
await registry.load();
const forecastSource = await registry.create({
  id: "mv-met-routine-forecast-test",
  entityId: "mv-met",
  name: "MMS Routine Forecast",
  platform: "web",
  collector: "web",
  url: forecastUrl,
  sourceType: "weather",
  country: "MV",
  languages: ["en"],
  priority: "P0",
  reliability: "official",
  tags: ["official", "weather", "forecast", "marine", "wave-height"],
  collectorConfig: { mode: "met_forecast", autoCollect: false, bootstrapMode: "mark_seen", discoveryUrl: forecastUrl, maxItemsPerPoll: 1, maxAgeHours: 36, minArticleBodyLength: 80, minArticleWords: 5 }
});
const tideSource = await registry.create({
  id: "mv-met-tide-predictions-test",
  entityId: "mv-met",
  name: "MMS Tide Predictions",
  platform: "web",
  collector: "web",
  url: tideUrl,
  sourceType: "weather",
  country: "MV",
  languages: ["en"],
  priority: "P0",
  reliability: "official",
  tags: ["official", "weather", "tide"],
  collectorConfig: { mode: "met_tide", autoCollect: false, bootstrapMode: "mark_seen", discoveryUrl: tideUrl, maxItemsPerPoll: 1, maxAgeHours: 48, minArticleBodyLength: 80, minArticleWords: 5 }
});

const fakeFetch = async (url) => {
  const key = String(url);
  if (key === forecastUrl) return { ok: true, status: 200, url: key, headers: { get: () => "text/html; charset=utf-8" }, text: async () => forecastHtml };
  if (key === tideUrl) return { ok: true, status: 200, url: key, headers: { get: () => "text/html; charset=utf-8" }, text: async () => tideHtml };
  return { ok: false, status: 404, url: key, headers: { get: () => "text/plain" }, text: async () => "not found" };
};
const submitted = [];
const collector = new ServerCollector({
  registry,
  statePath: path.join(tempDir, "collector-state.json"),
  enabled: false,
  fetchImpl: fakeFetch,
  submitCapture: async (payload) => { submitted.push(payload); return { ok: true }; },
  logger: { log() {}, error() {} }
});
await collector.load();

const forecastDry = await collector.pollSourceById(forecastSource.id, { dryRun: true });
assert.equal(forecastDry.mode, "met_forecast");
assert.equal(forecastDry.discovered, 1);
assert.equal(forecastDry.fresh, 1);
assert.equal(forecastDry.results[0].status, "preview");
assert.equal(forecastDry.results[0].weather.product, "mms_routine_forecast");
assert.equal(forecastDry.results[0].weather.edition, "day");
assert.equal(forecastDry.results[0].weather.generalWaveHeight, "2 – 5 feet.");
assert.equal(forecastDry.results[0].payload.contentType, "weather_forecast");
assert.equal(forecastDry.results[0].payload.eventType, "weather_update");
assert.equal(forecastDry.results[0].payload.metadata.deterministicStructured, true);
assert.equal(forecastDry.results[0].payload.metadata.stationOutlook.length, 15);
assert.equal(forecastDry.results[0].payload.metadata.marineForecast.waveHeight, "2 – 5 feet.");

const tideDry = await collector.pollSourceById(tideSource.id, { dryRun: true });
assert.equal(tideDry.mode, "met_tide");
assert.equal(tideDry.discovered, 1);
assert.equal(tideDry.fresh, 1);
assert.equal(tideDry.results[0].status, "preview");
assert.equal(tideDry.results[0].tide.product, "mms_tide_prediction");
assert.equal(tideDry.results[0].tide.pointCount, 6);
assert.equal(tideDry.results[0].payload.contentType, "tide_forecast");
assert.equal(tideDry.results[0].payload.eventType, "tide_update");
assert.equal(tideDry.results[0].payload.metadata.deterministicStructured, true);
assert.equal(tideDry.results[0].payload.metadata.tidePoints.length, 6);
assert.equal(submitted.length, 0);

// Fixed forecast URL must use a content fingerprint: unchanged editions submit once, changed editions submit again.
const updateDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-met-forecast-update-test-"));
const updateRegistry = new SourceRegistry({ storePath: path.join(updateDir, "sources.json") });
await updateRegistry.load();
const updateSource = await updateRegistry.create({ ...forecastSource, id: "mv-met-routine-update-test", collectorConfig: { ...forecastSource.collectorConfig, bootstrapMode: "publish_latest" } });
let updateVersion = 1;
const updateSubmitted = [];
const updateCollector = new ServerCollector({
  registry: updateRegistry,
  statePath: path.join(updateDir, "collector-state.json"),
  enabled: false,
  fetchImpl: async (url) => ({
    ok: true, status: 200, url: String(url), headers: { get: () => "text/html" },
    text: async () => updateVersion === 1 ? forecastHtml : forecastHtml.replace("Showers expected in isolated places with a few thunderstorms.", "Scattered rain with thunderstorms expected in several areas.")
  }),
  submitCapture: async (payload) => { updateSubmitted.push(payload); return { ok: true }; },
  logger: { log() {}, error() {} }
});
await updateCollector.load();
const updateFirst = await updateCollector.pollSourceById(updateSource.id, { dryRun: false });
assert.equal(updateFirst.submitted, 1);
const updateSecond = await updateCollector.pollSourceById(updateSource.id, { dryRun: false });
assert.equal(updateSecond.submitted, 0);
updateVersion = 2;
const updateThird = await updateCollector.pollSourceById(updateSource.id, { dryRun: false });
assert.equal(updateThird.submitted, 1);
assert.equal(updateSubmitted.length, 2);
assert.notEqual(updateSubmitted[0].captureId, updateSubmitted[1].captureId);

// A chart shell with no numeric heights must be diagnostic/retryable, never submitted or marked permanently seen.
const badDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-met-tide-shell-test-"));
const badRegistry = new SourceRegistry({ storePath: path.join(badDir, "sources.json") });
await badRegistry.load();
const badTideSource = await badRegistry.create({ ...tideSource, id: "mv-met-tide-shell-test", collectorConfig: { ...tideSource.collectorConfig, bootstrapMode: "publish_latest" } });
const badCollector = new ServerCollector({
  registry: badRegistry,
  statePath: path.join(badDir, "collector-state.json"),
  enabled: false,
  fetchImpl: async (url) => ({ ok: true, status: 200, url: String(url), headers: { get: () => "text/html" }, text: async () => `<h3>Tide prediction chart</h3><div>Hulhule</div><div>Sunday, Aug 9</div><h3>Moon phases</h3>` }),
  submitCapture: async () => { throw new Error("unusable tide chart must not submit"); },
  logger: { log() {}, error() {} }
});
await badCollector.load();
const badTide = await badCollector.pollSourceById(badTideSource.id, { dryRun: false });
assert.equal(badTide.results[0].status, "skipped_tide_unusable");
assert.equal(badTide.results[0].retryable, true);
assert.equal(badTide.results[0].pointCount, 0);

console.log("met-weather-collector tests passed");
