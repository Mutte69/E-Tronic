import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { normalizeSource } from "./source-registry.js";
import { isWorldSignalSource } from "./world-signal.js";

const pack = JSON.parse(await fs.readFile(new URL("./source-packs/world-core-v1.json", import.meta.url), "utf8"));
assert.equal(pack.pack, "world-core-v1");
assert.equal(pack.sources.length, 9);
const ids = new Set();
for (const raw of pack.sources) {
  const source = normalizeSource(raw, null, { touch: false });
  assert.equal(source.region, "WORLD");
  assert.equal(source.enabled, true);
  assert.equal(source.collectorConfig.autoCollect, false);
  assert.equal(source.collectorConfig.worldSignalEnabled, true);
  assert.equal(isWorldSignalSource(source), true);
  assert.ok(!ids.has(source.id), `duplicate source id ${source.id}`);
  ids.add(source.id);
}
assert.ok(ids.has("world-gdacs-rss"));
assert.ok(ids.has("world-usgs-significant-earthquakes"));
assert.ok(ids.has("world-who-disease-outbreak-news"));
console.log("world-source-pack tests passed (9 sources)");
