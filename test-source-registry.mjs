import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceRegistry, parseSourceCsv } from "./source-registry.js";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-source-registry-"));
const storePath = path.join(tempDir, "sources.json");
const registry = new SourceRegistry({ storePath });
await registry.load();

const policeWeb = await registry.create({
  name: "Maldives Police Service",
  entityId: "mv-police",
  platform: "web",
  collector: "web",
  url: "https://www.police.gov.mv/",
  sourceType: "public_safety",
  region: "MV",
  priority: "P0",
  reliability: "official",
  collectorConfig: { bootstrapMode: "mark_seen", pollIntervalSeconds: 120, maxItemsPerPoll: 8 }
});
assert.equal(policeWeb.entityId, "mv-police");
assert.equal(policeWeb.collectorConfig.pollIntervalSeconds, 120);
assert.equal(policeWeb.collectorConfig.bootstrapMode, "mark_seen");
assert.equal(registry.stats().total, 1);

const importResult = await registry.import([
  {
    name: "Maldives Police Service",
    entityId: "mv-police",
    platform: "x",
    collector: "x",
    url: "https://x.com/PoliceMv",
    sourceType: "public_safety",
    priority: "P0",
    reliability: "official"
  },
  {
    name: "Maldives Police Service",
    entityId: "mv-police",
    platform: "web",
    collector: "web",
    url: "https://www.police.gov.mv/",
    sourceType: "public_safety",
    priority: "P0",
    reliability: "official",
    tags: ["official", "emergency"]
  }
]);
assert.equal(importResult.created, 1);
assert.equal(importResult.updated, 1);
assert.equal(registry.stats().total, 2);
assert.equal(registry.stats().entities, 1);
assert.equal(registry.list({ platform: "x" }).length, 1);

const updated = await registry.update(policeWeb.id, { enabled: false });
assert.equal(updated.enabled, false);
assert.equal(registry.stats().disabled, 1);

const csv = `name,entity_id,platform,url,collector,source_type,region,priority,reliability,enabled\nMaldives Meteorological Service,mv-met,web,https://meteorology.gov.mv/,web,weather,MV,P0,official,true\n`;
const parsedCsv = parseSourceCsv(csv);
assert.equal(parsedCsv.length, 1);
assert.equal(parsedCsv[0].name, "Maldives Meteorological Service");
const csvImport = await registry.import(parsedCsv);
assert.equal(csvImport.created, 1);
assert.equal(registry.stats().total, 3);

const reloaded = new SourceRegistry({ storePath });
await reloaded.load();
assert.equal(reloaded.stats().total, 3);
assert.equal(reloaded.stats().entities, 2);

console.log("source-registry tests passed");
