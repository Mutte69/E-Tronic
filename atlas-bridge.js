function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function inferAtlasLanguage(payload) {
  const explicit = clean(payload.language).toLowerCase();
  if (explicit) return explicit;

  const sourceLanguages = Array.isArray(payload.metadata?.sourceLanguages)
    ? payload.metadata.sourceLanguages.map((value) => clean(value).toLowerCase()).filter(Boolean)
    : [];
  if (sourceLanguages.length === 1) return sourceLanguages[0];

  const sample = `${payload.headline || ""}\n${payload.body || ""}`.slice(0, 4000);
  const thaanaCount = (sample.match(/[\u0780-\u07BF]/gu) || []).length;
  const latinCount = (sample.match(/[A-Za-z]/g) || []).length;
  if (thaanaCount >= 8 && thaanaCount > latinCount * 0.4) return "dv";
  if (latinCount >= 12 && latinCount > thaanaCount * 1.5) return "en";
  return sourceLanguages[0] || "";
}

export function atlasCategoryHint(payload) {
  const explicit = clean(payload.category || payload.metadata?.category).toLowerCase();
  if (explicit) return explicit;

  const sourceType = clean(payload.metadata?.sourceType).toLowerCase();
  const tags = Array.isArray(payload.metadata?.sourceTags)
    ? payload.metadata.sourceTags.map((value) => clean(value).toLowerCase())
    : [];

  if (["business", "economy", "finance", "technology", "tech", "ai", "cybersecurity", "sports"].includes(sourceType)) {
    return sourceType;
  }
  if (sourceType === "weather") {
    const capMsgType = clean(payload.metadata?.capMsgType).toLowerCase();
    const capSeverity = clean(payload.metadata?.capSeverity).toLowerCase();
    if (["alert", "update", "cancel"].includes(capMsgType) || ["severe", "extreme"].includes(capSeverity)) return "weather_alert";
    return ["red", "emergency", "tsunami", "cyclone"].includes(clean(payload.alertTypeHint).toLowerCase())
      ? "weather_alert"
      : "weather";
  }
  if (sourceType === "emergency" && ["urgent", "emergency"].includes(payload.priority)) return "emergency";
  if (tags.includes("technology") || tags.includes("ai")) return "technology";
  if (tags.includes("business") || tags.includes("economy") || tags.includes("finance")) return "business";
  return "";
}

export function atlasRegionHint(payload) {
  // Source location is not the same as story location. Only forward explicit
  // story-level hints; Atlas performs its own deterministic content/source routing.
  return clean(payload.region || payload.metadata?.storyRegion).toLowerCase();
}

export function atlasCountryHint(payload) {
  return clean(payload.country || payload.metadata?.storyCountry).toUpperCase();
}

export function atlasPriority(payload) {
  const alertType = clean(payload.alertTypeHint).toLowerCase();
  const capSeverity = clean(payload.metadata?.capSeverity).toLowerCase();
  const capUrgency = clean(payload.metadata?.capUrgency).toLowerCase();
  const capCertainty = clean(payload.metadata?.capCertainty).toLowerCase();
  // Weather is not automatically Breaking. Only explicit severe/emergency
  // signals are promoted. CAP fields are authoritative structured values.
  if (["red", "emergency", "tsunami", "cyclone"].includes(alertType)) return "breaking";
  if (alertType === "orange") return "high";
  if (capSeverity === "extreme" && ["immediate", "expected"].includes(capUrgency) && ["observed", "likely"].includes(capCertainty)) return "breaking";
  if (capSeverity === "severe" && ["immediate", "expected"].includes(capUrgency)) return "high";
  if (payload.alertTypeHint === "emergency" && payload.priority === "urgent") return "breaking";
  if (payload.priority === "urgent_weather") return "normal";
  return payload.priority || "normal";
}

export function atlasEligibility(payload) {
  const contentType = clean(payload.contentType).toLowerCase();
  if (contentType !== "weather_image") return { eligible: true, reason: "eligible" };

  const hasImage = Boolean(clean(payload.imageBase64));
  const hasUrl = Boolean(clean(payload.finalUrl || payload.originalUrl));
  const text = `${clean(payload.headline)}\n${clean(payload.body)}`.toLowerCase();
  const meaningful = text
    .replace(/maldives weather/g, "")
    .replace(/forecaster\s*:\s*photo message/g, "")
    .replace(/photo message/g, "")
    .replace(/[^a-z0-9\u0780-\u07bf]+/gu, "")
    .length;

  if (!hasImage && !hasUrl && meaningful < 12) {
    return { eligible: false, reason: "weather_capture_incomplete" };
  }
  return { eligible: true, reason: "eligible_weather" };
}

export function buildAtlasPayload(payload) {
  const capturedAt = Number(payload.capturedAt || Date.now());
  const finalUrl = clean(payload.finalUrl || payload.originalUrl);
  return {
    capture_id: payload.captureId,
    region: atlasRegionHint(payload) || undefined,
    country: atlasCountryHint(payload) || undefined,
    category: atlasCategoryHint(payload) || undefined,
    priority: atlasPriority(payload),
    language: inferAtlasLanguage(payload) || undefined,
    source: {
      name: payload.sourceName,
      type: clean(payload.metadata?.sourceType, "media"),
      platform: payload.platform
    },
    headline: payload.headline || undefined,
    body: payload.body || undefined,
    url: finalUrl || undefined,
    image_url: clean(payload.imageUrl || payload.metadata?.imageUrl) || undefined,
    published_at: clean(payload.publishedAt || payload.metadata?.publishedAt) || undefined,
    captured_at: Number.isFinite(capturedAt) ? new Date(capturedAt).toISOString() : undefined,
    raw_capture: payload
  };
}

export function atlasRetryDelayMs(attempts) {
  const schedule = [15000, 60000, 300000, 900000, 3600000];
  return schedule[Math.min(Math.max(0, Number(attempts || 1) - 1), schedule.length - 1)];
}
