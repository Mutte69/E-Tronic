import crypto from "node:crypto";

const STOPWORDS = new Set([
  "about","after","again","against","amid","among","and","are","been","before","being","between","but","can","could","from","have","into","its","more","new","news","over","says","say","that","the","their","this","through","under","with","will","would","world","latest","live","update","updates"
]);

const SIGNALS = [
  { id: "war_escalation", points: 34, re: /\b(war|invasion|invades?|air\s?strikes?|missile(?:s)?|ballistic|bombardment|military\s+offensive|troops?\s+(?:enter|cross|invade)|ceasefire|armistice|mobilization|martial law|nuclear attack|nuclear weapon|hostilities)\b/i },
  { id: "coup_state_crisis", points: 30, re: /\b(coup|military takeover|state of emergency|government collaps(?:e|es|ed)|president resigns?|prime minister resigns?|impeach(?:ed|ment)|assassinat(?:ed|ion)|constitutional crisis)\b/i },
  { id: "major_disaster", points: 30, re: /\b(tsunami|major earthquake|earthquake|cyclone|hurricane|typhoon|volcanic eruption|eruption|wildfires?|floods?|landslide|catastrophic|disaster|evacuat(?:e|ed|ion))\b/i },
  { id: "election_power_change", points: 24, re: /\b(election results?|wins? election|elected president|elected prime minister|new president|new prime minister|government formed|parliament dissolved|snap election)\b/i },
  { id: "shipping_energy", points: 24, re: /\b(strait of hormuz|red sea|suez canal|shipping lane|shipping disruption|oil prices?|oil supply|gas supply|energy shock|tanker|port closure|blockade)\b/i },
  { id: "aviation_systemic", points: 23, re: /\b(airspace clos(?:ed|ure)|clos(?:e|es|ed) airspace|airport clos(?:ed|ure)|clos(?:e|es|ed) airport|flight ban|flights? suspended|aviation emergency|plane crash|airliner crash|commercial aircraft|ground stop)\b/i },
  { id: "health_outbreak", points: 28, re: /\b(outbreak|pandemic|epidemic|public health emergency|international health|disease outbreak|human-to-human transmission|novel virus)\b/i },
  { id: "markets_systemic", points: 24, re: /\b(market crash|markets? plunge|bank collapse|bank failure|sovereign default|debt default|currency crisis|financial crisis|global recession|emergency rate cut|capital controls)\b/i },
  { id: "cyber_critical", points: 25, re: /\b(cyberattack|cyber attack|ransomware|internet outage|telecom outage|power grid|critical infrastructure|massive data breach|global outage)\b/i },
  { id: "major_tech_ai", points: 18, re: /\b(artificial intelligence|\bAI\b|semiconductor|chip export|chip ban|advanced chips|frontier model|quantum computing|satellite network)\b/i },
  { id: "sanctions_diplomacy", points: 18, re: /\b(sanctions?|peace deal|peace agreement|treaty|diplomatic relations|recognises?|recognizes?|breaks relations|expels diplomats?|security council resolution)\b/i },
  { id: "mass_casualty", points: 18, re: /\b(?:kills?|killed|dead|deaths?|fatalities|injured)\s+(?:at least\s+)?(?:[5-9]\d|\d{3,})\b|\b(?:[5-9]\d|\d{3,})\s+(?:people\s+)?(?:killed|dead|deaths?|injured)\b/i },
  { id: "global_disruption", points: 18, re: /\b(worldwide|global disruption|across the world|multiple countries|international travel|international trade|supply chain disruption)\b/i }
];

const MALDIVES_RELEVANCE = [
  { id: "india", points: 15, re: /\bIndia|Indian\b/i },
  { id: "sri_lanka", points: 15, re: /\bSri Lanka|Sri Lankan\b/i },
  { id: "indian_ocean", points: 18, re: /\bIndian Ocean|Arabian Sea|Bay of Bengal\b/i },
  { id: "gulf", points: 15, re: /\bGulf|Saudi Arabia|UAE|United Arab Emirates|Qatar|Oman|Iran|Yemen|Bahrain|Kuwait\b/i },
  { id: "regional_shipping", points: 18, re: /\bHormuz|Red Sea|Suez|Bab el-Mandeb\b/i },
  { id: "south_asia", points: 10, re: /\bPakistan|Bangladesh|Nepal|Bhutan\b/i },
  { id: "china", points: 8, re: /\bChina|Chinese\b/i },
  { id: "major_power", points: 6, re: /\bUnited States|\bUS\b|Russia|European Union|\bEU\b|United Kingdom|\bUK\b\b/i }
];

const NOISE = [
  { id: "sports", points: -55, re: /\b(football|soccer|cricket|tennis|basketball|champions league|world cup|premier league|formula 1|grand prix|match|tournament|coach|striker|goalkeeper)\b/i },
  { id: "celebrity", points: -45, re: /\b(celebrity|actor|actress|singer|rapper|influencer|reality star|royal wedding|box office|album|movie|film premiere)\b/i },
  { id: "opinion_feature", points: -28, re: /\b(opinion|analysis|explainer|what we know|why it matters|feature|interview|podcast|in pictures|fact check)\b/i },
  { id: "routine_meeting", points: -22, re: /\b(meets with|holds meeting|conference opens|attends summit|welcomes delegation|signs memorandum|memorandum of understanding|workshop|seminar)\b/i },
  { id: "minor_crime", points: -22, re: /\b(arrested for|charged with|robbery|burglary|missing person|court appearance|local police)\b/i },
  { id: "lifestyle", points: -35, re: /\b(travel tips|recipe|fashion|lifestyle|restaurant|holiday deals|horoscope)\b/i }
];

function clean(value = "") { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function tagsOf(source) { return Array.isArray(source?.tags) ? source.tags.map((v) => clean(v).toLowerCase()) : []; }

export function isWorldSignalSource(source) {
  return clean(source?.region).toUpperCase() === "WORLD" || tagsOf(source).includes("world-signal");
}

export function correlationTokens(headline = "", body = "") {
  const text = `${headline} ${body}`.toLowerCase();
  const tokens = (text.match(/[a-z][a-z0-9'-]{2,}/g) || [])
    .map((token) => token.replace(/^['-]+|['-]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([token]) => token);
}

export function correlationSimilarity(a = [], b = []) {
  const aa = new Set(a); const bb = new Set(b);
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const item of aa) if (bb.has(item)) common += 1;
  const union = new Set([...aa, ...bb]).size;
  return union ? common / union : 0;
}

function sourceBase(source) {
  const tags = tagsOf(source);
  // High-signal feeds are authoritative, but feed membership alone must never equal global importance.
  // Earthquake impact is scored from structured USGS fields below.
  if (tags.includes("earthquake-signal")) return 10;
  if (tags.includes("world-authoritative-high-signal")) return 50;
  if (tags.includes("world-authoritative")) return 35;
  if (tags.includes("global-media")) return 8;
  if (clean(source?.reliability).toLowerCase() === "official") return 30;
  return 5;
}

function sourceCorroborationRequired(source) {
  const tags = tagsOf(source);
  if (tags.includes("no-corroboration-required")) return false;
  if (tags.includes("corroboration-required")) return true;
  return tags.includes("global-media");
}

function earthquakeImpact(source, article, reasons) {
  const tags = tagsOf(source);
  if (!tags.includes("earthquake-signal")) return 0;
  const quake = article?.earthquake || {};
  const magnitude = Number(quake.magnitude);
  const alert = clean(quake.pagerAlert || "").toLowerCase();
  const tsunami = Number(quake.tsunami || 0) === 1;
  const mmi = Number(quake.mmi);
  const felt = Number(quake.felt);
  const significance = Number(quake.significance);
  let points = 0;

  if (Number.isFinite(magnitude)) {
    const magPoints = magnitude >= 7 ? 50 : magnitude >= 6.5 ? 25 : magnitude >= 6 ? 15 : 0;
    if (magPoints) { points += magPoints; reasons.push({ id: `earthquake_magnitude_${magnitude >= 7 ? "7plus" : magnitude >= 6.5 ? "65plus" : "6plus"}`, points: magPoints, value: magnitude }); }
  }
  const pagerPoints = alert === "red" ? 60 : alert === "orange" ? 50 : alert === "yellow" ? 35 : 0;
  if (pagerPoints) { points += pagerPoints; reasons.push({ id: `earthquake_pager_${alert}`, points: pagerPoints }); }
  if (tsunami) { points += 50; reasons.push({ id: "earthquake_tsunami_flag", points: 50 }); }
  if (Number.isFinite(mmi) && mmi >= 8) { points += 25; reasons.push({ id: "earthquake_mmi_8plus", points: 25, value: mmi }); }
  else if (Number.isFinite(mmi) && mmi >= 7) { points += 15; reasons.push({ id: "earthquake_mmi_7plus", points: 15, value: mmi }); }
  if (Number.isFinite(felt) && felt >= 1000) { points += 12; reasons.push({ id: "earthquake_felt_1000plus", points: 12, value: felt }); }
  if (Number.isFinite(significance) && significance >= 1000) { points += 20; reasons.push({ id: "earthquake_sig_1000plus", points: 20, value: significance }); }
  else if (Number.isFinite(significance) && significance >= 800) { points += 12; reasons.push({ id: "earthquake_sig_800plus", points: 12, value: significance }); }
  else if (Number.isFinite(significance) && significance >= 650) { points += 8; reasons.push({ id: "earthquake_sig_650plus", points: 8, value: significance }); }
  return points;
}

function directAuthoritativeSignal(source, text, article) {
  const tags = tagsOf(source);
  if (!tags.includes("world-authoritative-high-signal")) return false;
  if (tags.includes("earthquake-signal")) {
    const quake = article?.earthquake || {};
    const magnitude = Number(quake.magnitude);
    const alert = clean(quake.pagerAlert || "").toLowerCase();
    return Number(quake.tsunami || 0) === 1 || ["yellow","orange","red"].includes(alert) || (Number.isFinite(magnitude) && magnitude >= 7);
  }
  if (tags.includes("disaster-signal")) return /\b(red|orange|earthquake|cyclone|flood|tsunami|volcano|wildfire|drought)\b/i.test(text);
  if (tags.includes("health-signal")) return /\b(outbreak|disease|public health|virus|infection|cases?)\b/i.test(text);
  return true;
}

export function evaluateWorldSignal({ source, article = {}, correlatedSources = 0, phase = "article" } = {}) {
  const headline = clean(article.headline || article.title || "");
  const body = clean(article.body || article.description || "");
  const text = `${headline}\n${body}`;
  const config = source?.collectorConfig || {};
  const candidateFloor = clamp(config.worldSignalCandidateFloor ?? 25, 0, 100);
  const watchScore = clamp(config.worldSignalWatchScore ?? 50, 0, 100);
  const publishScore = clamp(config.worldSignalPublishScore ?? 70, 0, 100);
  const reasons = [];
  let score = sourceBase(source);
  if (score) reasons.push({ id: "source_base", points: score });

  for (const signal of SIGNALS) {
    if (signal.re.test(text)) { score += signal.points; reasons.push({ id: signal.id, points: signal.points }); }
  }
  score += earthquakeImpact(source, article, reasons);
  for (const signal of MALDIVES_RELEVANCE) {
    if (signal.re.test(text)) { score += signal.points; reasons.push({ id: `mv_relevance_${signal.id}`, points: signal.points }); }
  }
  for (const noise of NOISE) {
    if (noise.re.test(text)) { score += noise.points; reasons.push({ id: `noise_${noise.id}`, points: noise.points }); }
  }

  const matchedSignalCount = reasons.filter((r) => r.points > 0 && r.id !== "source_base").length;
  if (matchedSignalCount >= 3) { score += 8; reasons.push({ id: "multi_signal", points: 8 }); }
  if (correlatedSources > 0) {
    const boost = Math.min(24, 16 + Math.max(0, correlatedSources - 1) * 4);
    score += boost;
    reasons.push({ id: "cross_source_corroboration", points: boost, sources: correlatedSources });
  }

  score = clamp(score, 0, 100);
  const authoritativeDirect = directAuthoritativeSignal(source, text, article);
  const requireCorroboration = sourceCorroborationRequired(source);
  let decision = "reject";
  let reason = "below_watch_threshold";

  if (phase === "candidate" && score < candidateFloor) {
    decision = "reject";
    reason = "below_candidate_floor";
  } else if (score >= publishScore) {
    if (requireCorroboration && correlatedSources < 1 && !authoritativeDirect) {
      decision = "watch";
      reason = "awaiting_corroboration";
    } else {
      decision = "pass";
      reason = authoritativeDirect ? "authoritative_high_signal" : correlatedSources > 0 ? "corroborated_high_impact" : "exceptional_single_source_impact";
    }
  } else if (score >= watchScore) {
    decision = "watch";
    reason = "impact_watch";
  }

  const tokens = correlationTokens(headline, body);
  const correlationKey = crypto.createHash("sha1").update(tokens.slice(0, 8).sort().join("|")).digest("hex").slice(0, 16);
  return {
    enabled: true,
    score,
    decision,
    reason,
    thresholds: { candidateFloor, watchScore, publishScore },
    requireCorroboration,
    correlatedSources,
    authoritativeDirect,
    reasons,
    tokens,
    correlationKey
  };
}
