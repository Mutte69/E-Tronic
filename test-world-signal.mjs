import assert from "node:assert/strict";
import { evaluateWorldSignal, correlationSimilarity } from "./world-signal.js";

const media = {
  region: "WORLD", reliability: "established", tags: ["world-signal","global-media","corroboration-required"],
  collectorConfig: { worldSignalCandidateFloor: 25, worldSignalWatchScore: 50, worldSignalPublishScore: 70 }
};
const official = (tags = []) => ({
  region: "WORLD", reliability: "official", tags: ["world-signal","world-authoritative-high-signal","no-corroboration-required", ...tags],
  collectorConfig: { worldSignalCandidateFloor: 20, worldSignalWatchScore: 50, worldSignalPublishScore: 70 }
});

let result = evaluateWorldSignal({ source: media, article: { headline: "Manchester wins football match in Champions League", body: "The coach praised his team after the tournament match." } });
assert.equal(result.decision, "reject");
assert.ok(result.score < 25);

result = evaluateWorldSignal({ source: media, article: { headline: "Missile attacks intensify as war expands near Strait of Hormuz", body: "Airstrikes and shipping disruption affect Gulf routes and international trade." } });
assert.equal(result.decision, "watch");
assert.equal(result.reason, "awaiting_corroboration");

const corroborated = evaluateWorldSignal({ source: media, correlatedSources: 1, article: { headline: "Missile attacks intensify as war expands near Strait of Hormuz", body: "Airstrikes and shipping disruption affect Gulf routes and international trade." } });
assert.equal(corroborated.decision, "pass");
assert.ok(corroborated.score >= result.score);

result = evaluateWorldSignal({ source: official(["health-signal"]), article: { headline: "Disease outbreak with international travel implications", body: "WHO reports confirmed cases and public health concern across multiple countries." } });
assert.equal(result.decision, "pass");

result = evaluateWorldSignal({ source: official(["disaster-signal"]), article: { headline: "Red alert tropical cyclone threatens several countries", body: "GDACS reports evacuation and severe cyclone impacts." } });
assert.equal(result.decision, "pass");

result = evaluateWorldSignal({ source: media, correlatedSources: 1, article: { headline: "India closes airspace after regional security emergency", body: "Flights are suspended and international travel is disrupted across South Asia." } });
assert.equal(result.decision, "pass");
assert.ok(result.reasons.some((r) => r.id === "mv_relevance_india"));

const a = ["iran","missile","hormuz","shipping","gulf"];
const b = ["iran","hormuz","shipping","attack","gulf"];
assert.ok(correlationSimilarity(a, b) >= 0.6);

console.log("world-signal tests passed");

const usgs = {
  region: "WORLD", reliability: "official",
  tags: ["world-signal","world-authoritative-high-signal","no-corroboration-required","earthquake-signal"],
  collectorConfig: { worldSignalCandidateFloor: 45, worldSignalWatchScore: 50, worldSignalPublishScore: 70 }
};

result = evaluateWorldSignal({
  source: usgs,
  phase: "candidate",
  article: {
    headline: "M 5.6 - 57 km WNW of Skwentna, Alaska",
    body: "Magnitude: M 5.6 Location: 57 km WNW of Skwentna, Alaska Tsunami flag: no",
    earthquake: { magnitude: 5.6, pagerAlert: null, tsunami: 0, mmi: null, felt: 0, significance: 0 }
  }
});
assert.equal(result.decision, "reject", "remote M5.6 without impact must die before AI");
assert.equal(result.reason, "below_candidate_floor");

result = evaluateWorldSignal({
  source: usgs,
  article: {
    headline: "M 7.2 - offshore earthquake",
    body: "Magnitude: M 7.2 Tsunami flag: no",
    earthquake: { magnitude: 7.2, pagerAlert: "green", tsunami: 0, mmi: 5, felt: 20, significance: 700 }
  }
});
assert.equal(result.decision, "pass", "M7+ authoritative earthquake is world-significant");

result = evaluateWorldSignal({
  source: usgs,
  article: {
    headline: "M 5.3 - damaging regional earthquake",
    body: "Magnitude: M 5.3 PAGER alert: yellow Tsunami flag: no",
    earthquake: { magnitude: 5.3, pagerAlert: "yellow", tsunami: 0, mmi: 7, felt: 1500, significance: 750 }
  }
});
assert.equal(result.decision, "pass", "PAGER yellow impact should pass even at lower magnitude");
