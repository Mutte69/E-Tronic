import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { ServerCollector, parseUsgsGeoJson } from "./server-collector.js";
import { normalizeSource } from "./source-registry.js";
import { correlationTokens } from "./world-signal.js";

function response(body, url, contentType = "application/rss+xml") {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : "" },
    text: async () => body
  };
}

const source = normalizeSource({
  id: "world-test-media",
  entityId: "test-media",
  name: "Test Global Media",
  platform: "rss",
  url: "https://example.test/world.xml",
  collector: "rss",
  sourceType: "general_news",
  region: "WORLD",
  country: "GB",
  languages: ["en"],
  priority: "P1",
  reliability: "established",
  tags: ["world-signal","global-media","corroboration-required"],
  collectorConfig: {
    mode: "rss", autoCollect: false, bootstrapMode: "mark_seen", maxItemsPerPoll: 10,
    maxAgeHours: 24, minArticleBodyLength: 100, minArticleWords: 12,
    worldSignalEnabled: true, worldSignalCandidateFloor: 25, worldSignalWatchScore: 50,
    worldSignalPublishScore: 70, worldSignalCorroborationHours: 12
  }
}, null, { touch: false });

const sportsBody = "The football club won its tournament match after a dramatic finish. The coach praised the players and supporters after the final whistle. This is ordinary sports coverage and should never reach the world signal downstream.";
const warBody = "Missile attacks intensified near the Strait of Hormuz as the war expanded across Gulf shipping routes. Several commercial shipping operators reported disruption to international trade and tanker traffic while governments reviewed emergency measures.";
const rss = `<?xml version="1.0"?><rss><channel>
  <item><guid>sports-1</guid><title>Football club wins Champions League match</title><link>https://example.test/sports-1</link><description>${sportsBody}</description><pubDate>${new Date().toUTCString()}</pubDate></item>
  <item><guid>war-1</guid><title>Missile attacks intensify as war expands near Strait of Hormuz</title><link>https://example.test/war-1</link><description>${warBody}</description><pubDate>${new Date().toUTCString()}</pubDate></item>
</channel></rss>`;

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "argus-world-test-"));
const registry = { list: () => [source], get: () => source, updateHealth: async () => {} };
let submitted = [];
let collector = new ServerCollector({
  registry,
  statePath: path.join(temp, "state.json"),
  fetchImpl: async (url) => response(rss, url),
  submitCapture: async (payload) => { submitted.push(payload); return { delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
collector.state.sources[source.id] = { initialized: true, seen: [], lastPollAt: null, lastSuccessAt: null };
let result = await collector.pollSource(source, { force: true });
assert.equal(submitted.length, 0, "uncorroborated media signal must not submit");
assert.ok(result.results.some((item) => item.status === "world_filtered_pre_ai" && /sports-1/.test(item.url || "")));
assert.ok(result.results.some((item) => item.status === "world_watch_pre_ai"));

submitted = [];
collector = new ServerCollector({
  registry,
  statePath: path.join(temp, "state2.json"),
  fetchImpl: async (url) => response(rss.replace(/<item><guid>sports-1[\s\S]*?<\/item>\s*/, ""), url),
  submitCapture: async (payload) => { submitted.push(payload); return { delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
collector.state.sources[source.id] = { initialized: true, seen: [], lastPollAt: null, lastSuccessAt: null };
collector.state.worldSignals = [{
  sourceId: "world-other-media",
  observedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  score: 74,
  decision: "watch",
  tokens: correlationTokens("War expands near Strait of Hormuz after missile attacks", "Gulf shipping routes and tanker traffic face international trade disruption.")
}];
result = await collector.pollSource(source, { force: true });
assert.equal(submitted.length, 1, "corroborated high-impact media signal should submit");
assert.equal(submitted[0].region, "WORLD");
assert.equal(submitted[0].metadata?.worldSignal?.decision, "pass");
assert.ok(submitted[0].metadata?.worldSignal?.correlatedSources?.length >= 1);



const usgsGeo = JSON.stringify({
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "quake-low",
    properties: {
      mag: 5.6,
      place: "57 km WNW of Skwentna, Alaska",
      time: Date.now(),
      updated: Date.now(),
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/quake-low",
      detail: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/quake-low.geojson",
      felt: 12,
      cdi: 3.2,
      mmi: 4,
      alert: "green",
      status: "reviewed",
      tsunami: 0,
      sig: 490,
      type: "earthquake"
    },
    geometry: { type: "Point", coordinates: [-151.2, 61.9, 42.3] }
  }]
});
const parsedQuakes = parseUsgsGeoJson(usgsGeo);
assert.equal(parsedQuakes.length, 1);
assert.equal(parsedQuakes[0].article.earthquake.magnitude, 5.6);
assert.match(parsedQuakes[0].article.body, /Depth: 42\.3 km/);
assert.doesNotMatch(parsedQuakes[0].article.body, /supports most recent browsers/i);

const usgsSource = normalizeSource({
  id: "world-usgs-significant-earthquakes",
  entityId: "usgs-earthquake-hazards",
  name: "USGS — Significant Earthquakes",
  platform: "api",
  url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson",
  collector: "rss",
  sourceType: "emergency",
  region: "WORLD",
  country: "US",
  languages: ["en"],
  priority: "P0",
  reliability: "official",
  tags: ["world-signal","world-authoritative-high-signal","no-corroboration-required","earthquake-signal","earthquake","emergency"],
  collectorConfig: {
    mode: "usgs_geojson", autoCollect: false, bootstrapMode: "mark_seen", maxItemsPerPoll: 10, maxAgeHours: 24,
    worldSignalEnabled: true, worldSignalCandidateFloor: 45, worldSignalWatchScore: 50,
    worldSignalPublishScore: 70, worldSignalCorroborationHours: 12
  }
}, null, { touch: false });

submitted = [];
const usgsCollector = new ServerCollector({
  registry: { list: () => [usgsSource], get: () => usgsSource, updateHealth: async () => {} },
  statePath: path.join(temp, "state-usgs.json"),
  fetchImpl: async (url) => response(usgsGeo, url, "application/geo+json"),
  submitCapture: async (payload) => { submitted.push(payload); return { delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
usgsCollector.state.sources[usgsSource.id] = { initialized: true, seen: [], lastPollAt: null, lastSuccessAt: null };
const usgsResult = await usgsCollector.pollSource(usgsSource, { force: true, dryRun: true });
assert.equal(submitted.length, 0);
assert.equal(usgsResult.results[0].status, "world_filtered_pre_ai");
assert.equal(usgsResult.results[0].worldSignal.decision, "reject");


const usgsGeoPass = JSON.stringify({
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "quake-pass",
    properties: {
      mag: 7.2,
      place: "offshore test region",
      time: Date.now(),
      updated: Date.now(),
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/quake-pass",
      detail: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/quake-pass.geojson",
      felt: 120,
      cdi: 5.1,
      mmi: 6,
      alert: "green",
      status: "reviewed",
      tsunami: 0,
      sig: 780,
      type: "earthquake"
    },
    geometry: { type: "Point", coordinates: [73.0, -2.0, 20.0] }
  }]
});
submitted = [];
const usgsPassCollector = new ServerCollector({
  registry: { list: () => [usgsSource], get: () => usgsSource, updateHealth: async () => {} },
  statePath: path.join(temp, "state-usgs-pass.json"),
  fetchImpl: async (url) => response(usgsGeoPass, url, "application/geo+json"),
  submitCapture: async (payload) => { submitted.push(payload); return { delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
usgsPassCollector.state.sources[usgsSource.id] = { initialized: true, seen: [], lastPollAt: null, lastSuccessAt: null };
const usgsPassResult = await usgsPassCollector.pollSource(usgsSource, { force: true, dryRun: true });
assert.equal(submitted.length, 0);
assert.equal(usgsPassResult.failed, 0, "passing USGS dry-run must construct structured payload without throwing");
assert.equal(usgsPassResult.results[0].status, "preview");
assert.equal(usgsPassResult.results[0].payload.eventType, "earthquake_event");
assert.equal(usgsPassResult.results[0].payload.metadata.earthquake.magnitude, 7.2);


await fs.rm(temp, { recursive: true, force: true });
console.log("world-collector tests passed");
