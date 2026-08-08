import assert from "node:assert/strict";
import { atlasCategoryHint, atlasEligibility, atlasPriority, atlasRegionHint, buildAtlasPayload, inferAtlasLanguage, atlasRetryDelayMs } from "./atlas-bridge.js";

const thaana = {
  captureId: "article_test",
  sourceName: "Sauvees",
  platform: "telegram",
  contentType: "link",
  priority: "normal",
  headline: "އެމްޕީބީއޭގެ ސެކްރެޓަރީ ޖެނެރަލްގެ މަގާމަށް މުނާ އައްޔަނުކޮށްފި",
  body: "މޯލްޑިވްސް ޕޫލް ބިލިއަޑް އެސޯސިއޭޝަންގެ މަގާމަށް މަރިޔަމް މުނާ އައްޔަންކޮށްފިއެވެ.",
  originalUrl: "https://sauvees.com/72074/",
  finalUrl: "https://sauvees.com/72074/",
  capturedAt: 1786200000000,
  metadata: {}
};

assert.equal(inferAtlasLanguage(thaana), "dv");
const atlas = buildAtlasPayload(thaana);
assert.equal(atlas.capture_id, "article_test");
assert.equal(atlas.language, "dv");
assert.equal(atlas.source.name, "Sauvees");
assert.equal(atlas.url, "https://sauvees.com/72074/");
assert.equal(atlas.headline, thaana.headline);
assert.equal(atlas.body, thaana.body);
assert.equal(atlas.raw_capture, thaana);

assert.equal(atlasPriority({ priority: "urgent_weather" }), "normal");
assert.equal(atlasPriority({ priority: "urgent_weather", alertTypeHint: "red" }), "breaking");
assert.equal(atlasPriority({ priority: "urgent_weather", alertTypeHint: "orange" }), "high");
assert.equal(atlasPriority({ priority: "normal" }), "normal");
assert.equal(atlasRegionHint({ metadata: { sourceRegion: "MV" } }), "");
assert.equal(atlasRegionHint({ metadata: { storyRegion: "maldives" } }), "maldives");
assert.equal(atlasCategoryHint({ category: "sports", metadata: {} }), "sports");
assert.equal(atlasCategoryHint({ metadata: { sourceType: "business" } }), "business");
assert.equal(atlasCategoryHint({ priority: "urgent_weather", alertTypeHint: "unknown", metadata: { sourceType: "weather" } }), "weather");
assert.equal(atlasCategoryHint({ priority: "urgent_weather", alertTypeHint: "red", metadata: { sourceType: "weather" } }), "weather_alert");
assert.equal(atlasCategoryHint({ contentType: "cap_alert", metadata: { sourceType: "weather", capMsgType: "Alert", capSeverity: "Moderate" } }), "weather_alert");
assert.equal(atlasPriority({ priority: "urgent", metadata: { capSeverity: "Extreme", capUrgency: "Immediate", capCertainty: "Likely" } }), "breaking");
assert.equal(atlasPriority({ priority: "high", metadata: { capSeverity: "Severe", capUrgency: "Expected", capCertainty: "Likely" } }), "high");
assert.equal(atlasPriority({ priority: "normal", metadata: { capSeverity: "Moderate", capUrgency: "Expected", capCertainty: "Likely" } }), "normal");
assert.deepEqual(atlasEligibility({ contentType: "weather_image", headline: "Maldives Weather", body: "Maldives Weather\nForecaster: Photo message" }), { eligible: false, reason: "weather_capture_incomplete" });
assert.equal(atlasEligibility({ contentType: "weather_image", headline: "Maldives Weather", body: "Orange alert issued for central atolls", imageBase64: "abc" }).eligible, true);

assert.deepEqual(
  [1, 2, 3, 4, 5, 9].map(atlasRetryDelayMs),
  [15000, 60000, 300000, 900000, 3600000, 3600000],
);

console.log("atlas-bridge tests passed");
