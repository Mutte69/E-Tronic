import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceRegistry } from "./source-registry.js";
import { ServerCollector, parseCapAlertXml, parseRssOrAtom } from "./server-collector.js";

const now = Date.now();
const sent = new Date(now - 5 * 60_000).toISOString();
const onset = new Date(now - 2 * 60_000).toISOString();
const expires = new Date(now + 4 * 60 * 60_000).toISOString();

const capXml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>MMS-2026-001</identifier>
  <sender>alerts@meteorology.gov.mv</sender>
  <sent>${sent}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en-US</language>
    <category>Met</category>
    <event>Yellow Advisory</event>
    <responseType>Prepare</responseType>
    <urgency>Expected</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <onset>${onset}</onset>
    <expires>${expires}</expires>
    <senderName>Maldives Meteorological Service</senderName>
    <headline>Yellow Advisory - Heavy rain and thunderstorms</headline>
    <description>Heavy rain and thunderstorms with strong gusts and rough seas are expected across the specified central Maldives region during the alert period.</description>
    <instruction>Seafarers are advised to exercise caution.</instruction>
    <web>https://meteorology.gov.mv/active_alerts</web>
    <parameter><valueName>Alert Level</valueName><value>Yellow Advisory</value></parameter>
    <eventCode><valueName>MMSCode</valueName><value>YELLOW</value></eventCode>
    <area>
      <areaDesc>From Raa Atoll to Vaavu Atoll</areaDesc>
      <polygon>5.7,72.8 5.7,73.6 2.2,73.6 2.2,72.8 5.7,72.8</polygon>
      <geocode><valueName>country</valueName><value>MV</value></geocode>
    </area>
  </info>
</alert>`;

const parsed = parseCapAlertXml(capXml);
assert.ok(parsed);
assert.equal(parsed.identifier, "MMS-2026-001");
assert.equal(parsed.status, "Actual");
assert.equal(parsed.msgType, "Alert");
assert.equal(parsed.scope, "Public");
assert.equal(parsed.info.event, "Yellow Advisory");
assert.equal(parsed.info.severity, "Severe");
assert.equal(parsed.info.urgency, "Expected");
assert.equal(parsed.info.certainty, "Likely");
assert.equal(parsed.info.areas[0].areaDesc, "From Raa Atoll to Vaavu Atoll");
assert.equal(parsed.info.parameters[0].value, "Yellow Advisory");
assert.equal(parsed.alertColor, "yellow");

const capUrl = "https://cap.meteorology.gov.mv/alerts/MMS-2026-001.xml";
const rssXml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Maldives Meteorological Service Alerts</title>
  <item>
    <guid>MMS-2026-001</guid>
    <title>Yellow Advisory - Heavy rain and thunderstorms</title>
    <link>${capUrl}</link>
    <description>Official CAP alert</description>
    <pubDate>${new Date(now - 5 * 60_000).toUTCString()}</pubDate>
  </item>
</channel></rss>`;

const items = parseRssOrAtom(rssXml, "https://cap.meteorology.gov.mv/rss/alerts/");
assert.equal(items.length, 1);
assert.equal(items[0].feedId, "MMS-2026-001");
assert.equal(items[0].url, capUrl);

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-cap-test-"));
const registry = new SourceRegistry({ storePath: path.join(tempDir, "sources.json") });
await registry.load();
const source = await registry.create({
  id: "mv-met-cap-alerts-test",
  entityId: "mv-met",
  name: "Maldives Meteorological Service CAP Alerts",
  platform: "rss",
  collector: "rss",
  url: "https://cap.meteorology.gov.mv/rss/alerts/",
  sourceType: "weather",
  country: "MV",
  languages: ["en"],
  priority: "P0",
  reliability: "official",
  tags: ["official", "weather", "cap", "alerts"],
  collectorConfig: {
    mode: "cap",
    autoCollect: false,
    bootstrapMode: "mark_seen",
    feedUrl: "https://cap.meteorology.gov.mv/rss/alerts/",
    pollIntervalSeconds: 60,
    maxItemsPerPoll: 10,
    maxAgeHours: 168
  }
});

const fakeFetch = async (url) => {
  const key = String(url);
  if (key === "https://cap.meteorology.gov.mv/rss/alerts/") {
    return { ok: true, status: 200, url: key, headers: { get: () => "application/rss+xml" }, text: async () => rssXml };
  }
  if (key === capUrl) {
    return { ok: true, status: 200, url: key, headers: { get: () => "application/xml" }, text: async () => capXml };
  }
  return { ok: false, status: 404, url: key, headers: { get: () => "text/plain" }, text: async () => "not found" };
};

const submitted = [];
const collector = new ServerCollector({
  registry,
  statePath: path.join(tempDir, "collector-state.json"),
  enabled: false,
  fetchImpl: fakeFetch,
  submitCapture: async (payload) => { submitted.push(payload); return { ok: true, delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
await collector.load();

const dryRun = await collector.pollSourceById(source.id, { dryRun: true });
assert.equal(dryRun.mode, "cap");
assert.equal(dryRun.discovered, 1);
assert.equal(dryRun.fresh, 1);
assert.equal(dryRun.submitted, 0);
assert.equal(dryRun.failed, 0);
assert.equal(dryRun.results[0].status, "preview");
assert.equal(dryRun.results[0].cap.identifier, "MMS-2026-001");
assert.equal(dryRun.results[0].cap.alertColor, "yellow");
assert.equal(dryRun.results[0].cap.areas[0], "From Raa Atoll to Vaavu Atoll");
assert.equal(dryRun.results[0].payload.contentType, "cap_alert");
assert.equal(dryRun.results[0].payload.eventType, "weather_alert");
assert.equal(dryRun.results[0].payload.priority, "high");
assert.equal(dryRun.results[0].payload.alertTypeHint, "yellow");
assert.equal(dryRun.results[0].payload.metadata.deterministicStructured, true);
assert.equal(dryRun.results[0].payload.metadata.capIdentifier, "MMS-2026-001");
assert.equal(dryRun.results[0].payload.metadata.capSeverity, "Severe");
assert.deepEqual(dryRun.results[0].payload.metadata.capAreaDescriptions, ["From Raa Atoll to Vaavu Atoll"]);
assert.equal(submitted.length, 0);

// A non-dry-run first poll must preserve the existing safe mark_seen bootstrap behavior.
const bootstrap = await collector.pollSourceById(source.id, { dryRun: false });
assert.equal(bootstrap.bootstrapped, true);
assert.equal(submitted.length, 0);

// Test/Exercise CAP messages are deterministic non-actionable messages, not retry poison.
const exerciseXml = capXml
  .replace("MMS-2026-001", "MMS-2026-EXERCISE")
  .replace("<status>Actual</status>", "<status>Exercise</status>");
const exerciseUrl = "https://cap.meteorology.gov.mv/alerts/MMS-2026-EXERCISE.xml";
const exerciseRss = rssXml.replace(/MMS-2026-001/g, "MMS-2026-EXERCISE").replace(capUrl, exerciseUrl);
const tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), "argus-cap-exercise-test-"));
const registry2 = new SourceRegistry({ storePath: path.join(tempDir2, "sources.json") });
await registry2.load();
const source2 = await registry2.create({ ...source, id: "mv-met-cap-exercise-test", collectorConfig: { ...source.collectorConfig, bootstrapMode: "publish_latest" } });
const collector2 = new ServerCollector({
  registry: registry2,
  statePath: path.join(tempDir2, "collector-state.json"),
  enabled: false,
  fetchImpl: async (url) => {
    const key = String(url);
    if (key === "https://cap.meteorology.gov.mv/rss/alerts/") return { ok: true, status: 200, url: key, headers: { get: () => "application/rss+xml" }, text: async () => exerciseRss };
    if (key === exerciseUrl) return { ok: true, status: 200, url: key, headers: { get: () => "application/xml" }, text: async () => exerciseXml };
    return { ok: false, status: 404, url: key, headers: { get: () => "text/plain" }, text: async () => "not found" };
  },
  submitCapture: async () => { throw new Error("exercise CAP must not submit"); },
  logger: { log() {}, error() {} }
});
await collector2.load();
const exercise = await collector2.pollSourceById(source2.id, { dryRun: false });
assert.equal(exercise.results[0].status, "skipped_cap_non_actionable");
assert.equal(exercise.results[0].reason, "cap_status_exercise");
assert.equal(exercise.results[0].retryable, false);

// Update/Cancel messages keep CAP references so downstream correlation can link revisions.
const update = parseCapAlertXml(capXml
  .replace("MMS-2026-001", "MMS-2026-002")
  .replace("<msgType>Alert</msgType>", "<msgType>Update</msgType>")
  .replace("<scope>Public</scope>", "<scope>Public</scope><references>alerts@meteorology.gov.mv,MMS-2026-001,2026-08-09T00:00:00+05:00</references>"));
assert.equal(update.msgType, "Update");
assert.ok(update.references.includes("MMS-2026-001"));

const cancel = parseCapAlertXml(capXml
  .replace("MMS-2026-001", "MMS-2026-003")
  .replace("<msgType>Alert</msgType>", "<msgType>Cancel</msgType>")
  .replace("<scope>Public</scope>", "<scope>Public</scope><references>alerts@meteorology.gov.mv,MMS-2026-002,2026-08-09T00:10:00+05:00</references>"));
assert.equal(cancel.msgType, "Cancel");
assert.ok(cancel.references.includes("MMS-2026-002"));

console.log("cap-collector tests passed");
