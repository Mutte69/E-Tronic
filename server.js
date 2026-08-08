import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { SourceRegistry, parseSourceCsv } from "./source-registry.js";
import { ServerCollector } from "./server-collector.js";
import { buildAtlasPayload, atlasEligibility, atlasRetryDelayMs } from "./atlas-bridge.js";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.text({ type: ["text/csv", "application/csv"], limit: "10mb" }));

const PORT = Number(process.env.PORT || 3000);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_BASE_URL = (process.env.TELEGRAM_BASE_URL || "https://api.telegram.org").replace(/\/+$/, "");
const ARGUS_RELAY_SECRET = process.env.ARGUS_RELAY_SECRET || "";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const DEEPSEEK_TIMEOUT_MS = boundedNumber(process.env.DEEPSEEK_TIMEOUT_MS, 45000, 5000, 120000);

const SAMUGA_INGEST_URL = (process.env.SAMUGA_INGEST_URL || "").replace(/\/+$/, "");
const SAMUGA_INGEST_SECRET = process.env.SAMUGA_INGEST_SECRET || "";

const ATLAS_WIRE_INGEST_URL = (process.env.ATLAS_WIRE_INGEST_URL || "").replace(/\/+$/, "");
const ATLAS_WIRE_INGEST_SECRET = process.env.ATLAS_WIRE_INGEST_SECRET || "";
const ATLAS_RETRY_INTERVAL_MS = boundedNumber(process.env.ATLAS_RETRY_INTERVAL_MS, 30000, 5000, 3600000);
const ATLAS_RETRY_BATCH = boundedNumber(process.env.ATLAS_RETRY_BATCH, 25, 1, 200);

const EVENT_STORE_PATH = process.env.EVENT_STORE_PATH || path.resolve("data/argus-events.json");
const CAPTURE_ARCHIVE_PATH = process.env.CAPTURE_ARCHIVE_PATH || path.resolve("data/argus-captures.jsonl");
const SOURCE_STORE_PATH = process.env.ARGUS_SOURCE_STORE_PATH || path.resolve("data/argus-sources.json");
const COLLECTOR_STATE_PATH = process.env.ARGUS_COLLECTOR_STATE_PATH || path.resolve("data/argus-collector-state.json");
const SOURCE_PACK_PATH = process.env.ARGUS_SOURCE_PACK_PATH || path.resolve("source-packs/maldives-core-v1.json");
const SOURCE_PACK_AUTO_IMPORT = parseBoolean(process.env.ARGUS_SOURCE_PACK_AUTO_IMPORT, false);
const WORLD_SOURCE_PACK_PATH = process.env.ARGUS_WORLD_SOURCE_PACK_PATH || path.resolve("source-packs/world-core-v1.json");
const WORLD_SOURCE_PACK_AUTO_IMPORT = parseBoolean(process.env.ARGUS_WORLD_SOURCE_PACK_AUTO_IMPORT, SOURCE_PACK_AUTO_IMPORT);
const SERVER_COLLECTORS_ENABLED = parseBoolean(process.env.ARGUS_SERVER_COLLECTORS_ENABLED, false);
const COLLECTOR_CYCLE_INTERVAL_MS = boundedNumber(process.env.ARGUS_COLLECTOR_CYCLE_INTERVAL_MS, 60000, 30000, 3600000);
const COLLECTOR_FETCH_TIMEOUT_MS = boundedNumber(process.env.ARGUS_COLLECTOR_FETCH_TIMEOUT_MS, 15000, 3000, 120000);
const COLLECTOR_MAX_CONCURRENCY = boundedNumber(process.env.ARGUS_COLLECTOR_MAX_CONCURRENCY, 3, 1, 12);
const EVENT_WINDOW_HOURS = boundedNumber(process.env.EVENT_WINDOW_HOURS, 72, 6, 336);
const EVENT_MATCH_CONFIDENCE = boundedNumber(process.env.EVENT_MATCH_CONFIDENCE, 0.88, 0.5, 1);
const EVENT_UPDATE_CONFIDENCE = boundedNumber(process.env.EVENT_UPDATE_CONFIDENCE, 0.8, 0.5, 1);
const EVENT_CANDIDATE_LIMIT = boundedNumber(process.env.EVENT_CANDIDATE_LIMIT, 12, 3, 30);
const EVENT_STORE_MAX_EVENTS = boundedNumber(process.env.EVENT_STORE_MAX_EVENTS, 5000, 100, 50000);
const CAPTURE_INDEX_LIMIT = boundedNumber(process.env.CAPTURE_INDEX_LIMIT, 20000, 1000, 100000);
const TELEGRAM_SUPPORTING_COVERAGE = parseBoolean(process.env.TELEGRAM_SUPPORTING_COVERAGE, false);
const SAMUGA_RETRY_INTERVAL_MS = boundedNumber(process.env.SAMUGA_RETRY_INTERVAL_MS, 60000, 15000, 3600000);
const SAMUGA_RETRY_BATCH = boundedNumber(process.env.SAMUGA_RETRY_BATCH, 10, 1, 100);

const deliveredCaptureIds = new Map();
const MAX_DELIVERED_CACHE = 5000;
let stateWriteChain = Promise.resolve();
let eventState = await loadEventState();
const sourceRegistry = new SourceRegistry({ storePath: SOURCE_STORE_PATH });
await sourceRegistry.load();

async function importBundledSourcePack(packPath, enabled, label) {
  if (!enabled) return null;
  try {
    const raw = await fs.readFile(packPath, "utf8");
    const parsed = JSON.parse(raw);
    const sources = Array.isArray(parsed) ? parsed : parsed?.sources;
    if (!Array.isArray(sources)) throw new Error("Source pack must contain a sources array");
    const result = await sourceRegistry.import(sources);
    console.log(`[SOURCE_PACK_IMPORT] label=${label} path=${packPath} rows=${result.totalRows} created=${result.created} updated=${result.updated} invalid=${result.invalid}`);
    return result;
  } catch (error) {
    console.error(`[SOURCE_PACK_IMPORT_FAILED] label=${label} path=${packPath} error=${JSON.stringify(error?.message || String(error))}`);
    return null;
  }
}

await importBundledSourcePack(SOURCE_PACK_PATH, SOURCE_PACK_AUTO_IMPORT, "maldives");
await importBundledSourcePack(WORLD_SOURCE_PACK_PATH, WORLD_SOURCE_PACK_AUTO_IMPORT, "world");

const serverCollector = new ServerCollector({
  registry: sourceRegistry,
  statePath: COLLECTOR_STATE_PATH,
  enabled: SERVER_COLLECTORS_ENABLED,
  cycleIntervalMs: COLLECTOR_CYCLE_INTERVAL_MS,
  fetchTimeoutMs: COLLECTOR_FETCH_TIMEOUT_MS,
  maxConcurrency: COLLECTOR_MAX_CONCURRENCY,
  relayUrl: `http://127.0.0.1:${PORT}`,
  relaySecret: ARGUS_RELAY_SECRET
});
await serverCollector.load();

const runtime = {
  startedAt: nowIso(),
  received: 0,
  cleaned: 0,
  telegramSent: 0,
  samugaForwarded: 0,
  atlasForwarded: 0,
  atlasFailures: 0,
  failures: 0,
  lastCaptureId: null,
  lastStage: "startup",
  lastError: null,
  lastActivityAt: null
};

function stage(name, captureId, details = "") {
  runtime.lastStage = name;
  runtime.lastCaptureId = captureId || runtime.lastCaptureId;
  runtime.lastActivityAt = nowIso();
  const suffix = details ? ` ${details}` : "";
  console.log(`[${name}] capture=${captureId || "none"}${suffix}`);
}

function stageError(name, captureId, error) {
  runtime.failures += 1;
  runtime.lastStage = name;
  runtime.lastCaptureId = captureId || runtime.lastCaptureId;
  runtime.lastActivityAt = nowIso();
  runtime.lastError = error instanceof Error ? error.message : String(error);
  console.error(`[${name}] capture=${captureId || "none"} error=${runtime.lastError}`, error);
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function clean(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function rememberDelivered(captureId) {
  deliveredCaptureIds.set(captureId, Date.now());
  while (deliveredCaptureIds.size > MAX_DELIVERED_CACHE) {
    const oldest = deliveredCaptureIds.keys().next().value;
    deliveredCaptureIds.delete(oldest);
  }
}

function samugaEndpoint() {
  if (!SAMUGA_INGEST_URL) return "";
  if (/\/api\/internal\/argus\/ingest\/?$/i.test(SAMUGA_INGEST_URL)) return SAMUGA_INGEST_URL;
  return `${SAMUGA_INGEST_URL}/api/internal/argus/ingest`;
}

function requiredMissing() {
  // The test group is specifically a DeepSeek-cleaning verification surface.
  // Therefore article delivery requires DeepSeek as well as Telegram and the
  // shared relay secret. A cleaning failure returns a retryable error instead
  // of silently showing raw extraction as though it were cleaned.
  return [
    ["TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN],
    ["TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID],
    ["ARGUS_RELAY_SECRET", ARGUS_RELAY_SECRET],
    ["DEEPSEEK_API_KEY", DEEPSEEK_API_KEY]
  ].filter(([, value]) => !value).map(([name]) => name);
}

function samugaConfigured() {
  return Boolean(SAMUGA_INGEST_URL && SAMUGA_INGEST_SECRET);
}

function atlasEndpoint() {
  if (!ATLAS_WIRE_INGEST_URL) return "";
  if (/\/api\/internal\/atlas-wire\/ingest\/?$/i.test(ATLAS_WIRE_INGEST_URL)) return ATLAS_WIRE_INGEST_URL;
  return `${ATLAS_WIRE_INGEST_URL}/api/internal/atlas-wire/ingest`;
}

function atlasConfigured() {
  return Boolean(ATLAS_WIRE_INGEST_URL && ATLAS_WIRE_INGEST_SECRET);
}

function deepSeekConfigured() {
  return Boolean(DEEPSEEK_API_KEY);
}

function shouldCleanArticle(payload) {
  if (payload.contentType === "cap_alert" || payload.metadata?.deterministicStructured === true) return false;
  if (payload.priority === "urgent_weather") return false;
  if (payload.imageBase64 && !payload.body) return false;
  return payload.contentType === "link" || Boolean(payload.originalUrl || payload.finalUrl);
}

function shouldClassifyEvent(payload) {
  if (payload.contentType === "cap_alert") return payload.body.length >= 40;
  return shouldCleanArticle(payload) && payload.body.length >= 80;
}

function numberedLines(headline, body) {
  const lines = [];
  const push = (value, kind) => {
    String(value || "").split(/\r?\n/).forEach((text) => {
      const trimmed = text.trim();
      if (trimmed) lines.push({ id: lines.length + 1, text: trimmed, kind });
    });
  };
  push(headline, "headline_candidate");
  push(body, "body");
  return lines;
}

function uniqueValidIds(value, max) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))];
}

async function deepSeekJson(system, user, maxTokens = 1800, captureId = "unknown", purpose = "unknown") {
  if (!deepSeekConfigured()) throw new Error("DEEPSEEK_API_KEY is required");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);
  const started = Date.now();
  stage("DEEPSEEK_START", captureId, `purpose=${purpose} model=${DEEPSEEK_MODEL}`);
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        thinking: { type: "disabled" },
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      }),
      signal: controller.signal
    });
    const rawText = await response.text();
    let data;
    try { data = rawText ? JSON.parse(rawText) : {}; }
    catch { throw new Error(`DeepSeek returned invalid HTTP JSON: ${rawText.slice(0, 500)}`); }
    if (!response.ok) throw new Error(`DeepSeek failed: HTTP ${response.status} ${JSON.stringify(data).slice(0, 700)}`);
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content || !String(content).trim()) {
      throw new Error(`DeepSeek returned no JSON result; finish_reason=${choice?.finish_reason || "unknown"}`);
    }
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { throw new Error(`DeepSeek returned invalid result JSON: ${String(content).slice(0, 500)}`); }
    stage("DEEPSEEK_SUCCESS", captureId, `purpose=${purpose} ms=${Date.now() - started} finish=${choice?.finish_reason || "unknown"}`);
    return parsed;
  } catch (error) {
    const normalized = error?.name === "AbortError"
      ? new Error(`DeepSeek timeout after ${DEEPSEEK_TIMEOUT_MS}ms`)
      : error;
    stageError("DEEPSEEK_FAILED", captureId, normalized);
    throw normalized;
  } finally {
    clearTimeout(timeout);
  }
}

async function cleanWithDeepSeek(payload) {
  if (!shouldCleanArticle(payload)) return { payload, status: "skipped", reason: "not_link_article" };

  const lines = numberedLines(payload.headline, payload.body);
  if (!lines.length) throw new Error("Article capture contains no text to clean");

  const baseSystem = `You are ARGUS Hard Cleaner. Return JSON only. Select exact original line IDs; never rewrite, summarize, translate, correct, merge, split or reorder text. Remove browser UI, navigation, ads, sponsors, cookie notices, social controls, image filenames, related stories, tags, reactions, comments, contact details, footer, menus and unrelated headlines. Keep the genuine published headline and every genuine article paragraph, caption and meaningful subheading. Do not shorten or summarize the article. Output exactly: {"headlineLine":1,"bodyLines":[2,3]}. bodyLines must be in original ascending order.`;

  const meaningfulLength = (value) => [...String(value || "")]
    .filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
  const nonEmptyLineCount = (value) => String(value || "").split(/\n+/).filter((line) => line.trim()).length;

  const evaluateSelection = (result) => {
    const headlineId = Number(result?.headlineLine);
    const bodyIds = uniqueValidIds(result?.bodyLines, lines.length).sort((a, b) => a - b);
    if (!Number.isInteger(headlineId) || headlineId < 1 || headlineId > lines.length) {
      const error = new Error("DeepSeek did not select a valid headline line");
      error.code = "CLEANING_UNUSABLE";
      error.cleaningDetails = { reason: "no_valid_headline", attempts: 1 };
      throw error;
    }
    if (!bodyIds.length) {
      const error = new Error("DeepSeek did not select any article body lines");
      error.code = "CLEANING_UNUSABLE";
      error.cleaningDetails = {
        reason: "no_body_lines_selected",
        attempts: 1,
        originalMeaningful: meaningfulLength(payload.body)
      };
      throw error;
    }

    const cleanHeadline = lines[headlineId - 1].text;
    const cleanBody = bodyIds.filter((id) => id !== headlineId).map((id) => lines[id - 1].text).join("\n").trim();
    const bodyMeaningful = meaningfulLength(cleanBody);
    const bodyLineCount = nonEmptyLineCount(cleanBody);
    const originalMeaningful = meaningfulLength(payload.body);

    return {
      headlineId,
      bodyIds,
      cleanHeadline,
      cleanBody,
      bodyMeaningful,
      bodyLineCount,
      originalMeaningful,
      headlineValid: meaningfulLength(cleanHeadline) >= 3,
      normalValid: bodyMeaningful >= 80,
      shortValid:
        bodyMeaningful >= 40 &&
        originalMeaningful <= 500 &&
        (
          bodyLineCount >= 2 ||
          /[.!?މެވެ]/u.test(cleanBody) ||
          (originalMeaningful <= 120 && bodyMeaningful >= Math.max(20, Math.floor(originalMeaningful * 0.7)))
        )
    };
  };

  const requestSelection = async (system, attempt) => {
    const result = await deepSeekJson(system, JSON.stringify({
      source: payload.sourceName,
      url: payload.finalUrl || payload.originalUrl,
      lines
    }), 1800, payload.captureId, attempt === 1 ? "cleaning" : "cleaning_retry");
    return evaluateSelection(result);
  };

  let selected = await requestSelection(baseSystem, 1);
  let attempts = 1;
  let validationStatus = "cleaned";

  if (!selected.headlineValid || (!selected.normalValid && !selected.shortValid)) {
    stage(
      "CLEANING_RETRY",
      payload.captureId,
      `reason=short_or_invalid headline=${selected.cleanHeadline.length} body=${selected.cleanBody.length} meaningful=${selected.bodyMeaningful} originalMeaningful=${selected.originalMeaningful}`
    );
    const retrySystem = `${baseSystem}\nIMPORTANT RETRY: Your first selection removed too much. Re-check every line. Keep ALL genuine article paragraphs and captions. A short notice may be brief, but a normal article must not be reduced to only one sentence. Exclude only obvious interface, advertisement and unrelated material.`;
    selected = await requestSelection(retrySystem, 2);
    attempts = 2;
    validationStatus = "cleaned_retry";
  }

  if (!selected.headlineValid) throw new Error("DeepSeek cleaning result has no meaningful headline");
  if (!selected.normalValid && !selected.shortValid) {
    const error = new Error(
      `DeepSeek cleaning result was too short after ${attempts} attempt(s): body=${selected.cleanBody.length} meaningful=${selected.bodyMeaningful} originalMeaningful=${selected.originalMeaningful}`
    );
    error.code = "CLEANING_UNUSABLE";
    error.cleaningDetails = {
      attempts,
      cleanHeadline: selected.cleanHeadline,
      cleanBody: selected.cleanBody,
      bodyMeaningful: selected.bodyMeaningful,
      originalMeaningful: selected.originalMeaningful
    };
    throw error;
  }
  if (selected.shortValid && !selected.normalValid) validationStatus = "cleaned_short_valid";

  return {
    status: validationStatus,
    payload: {
      ...payload,
      headline: selected.cleanHeadline,
      body: selected.cleanBody,
      raw: {
        ...payload.raw,
        originalHeadline: payload.headline,
        originalBody: payload.body
      },
      metadata: {
        ...payload.metadata,
        cleaningStatus: validationStatus,
        cleaningProvider: "deepseek",
        cleaningModel: DEEPSEEK_MODEL,
        cleaningCompletedAt: nowIso(),
        cleaningAttempts: attempts,
        cleanBodyLength: selected.cleanBody.length,
        cleanBodyMeaningfulLength: selected.bodyMeaningful,
        removedLineCount: lines.length - new Set([selected.headlineId, ...selected.bodyIds]).size
      }
    }
  };
}

function stringArray(value, max = 20) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, "")).filter(Boolean))].slice(0, max);
}

function recentEventCandidates() {
  const cutoff = Date.now() - EVENT_WINDOW_HOURS * 60 * 60 * 1000;
  return eventState.events
    .filter((event) => Date.parse(event.updatedAt || event.createdAt) >= cutoff)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, EVENT_CANDIDATE_LIMIT)
    .map((event) => ({
      eventId: event.eventId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      canonicalSummary: event.canonicalSummary,
      eventType: event.eventType,
      eventDate: event.eventDate,
      location: event.location,
      actors: event.actors,
      organizations: event.organizations,
      actions: event.actions,
      facts: event.facts,
      numbers: event.numbers,
      sourceCount: event.coverage.length
    }));
}

async function understandAndMatchEvent(payload, candidates) {
  if (!shouldClassifyEvent(payload)) {
    return {
      decision: "bypass",
      matchedEventId: null,
      confidence: 0,
      newInformation: [],
      fingerprint: null
    };
  }

  const system = `You are ARGUS Event Intelligence. Return JSON only. Analyze the cleaned news article as a real-world event, not as a duplicate-text problem. Different Maldives outlets may use different headlines, languages, structure and political framing for the same event. Compare meaning, actors, actions, place, date, figures and developments. Normalize eventType, subject, actions and factual propositions into concise English for cross-language matching, but preserve proper names and exact numbers. Do not write editorial copy.

Choose matchedEventId only from the supplied candidateEvents when the article reports the same underlying event. A related topic is not enough. Determine whether the article adds meaningful new information such as a new quote, response, actor, figure, document, correction, official confirmation, consequence or development.

Output exactly this JSON shape:
{"fingerprint":{"eventType":"","eventDate":"YYYY-MM-DD or unknown","location":"","subject":"","canonicalSummary":"","actors":[],"organizations":[],"actions":[],"facts":[],"numbers":[],"quotes":[]},"matchedEventId":null,"matchConfidence":0.0,"newInformation":[]}

facts must be short atomic factual propositions. newInformation must contain only information absent from the matched candidate. If there is no same event, matchedEventId must be null and matchConfidence 0.`;

  const result = await deepSeekJson(system, JSON.stringify({
    article: {
      source: payload.sourceName,
      capturedAt: payload.capturedAt,
      url: payload.finalUrl || payload.originalUrl,
      headline: payload.headline,
      body: payload.body
    },
    candidateEvents: candidates
  }), 2400, payload.captureId, "event_match");

  const fp = result?.fingerprint && typeof result.fingerprint === "object" ? result.fingerprint : {};
  const candidateIds = new Set(candidates.map((item) => item.eventId));
  const proposedId = clean(result.matchedEventId, "");
  const matchedEventId = candidateIds.has(proposedId) ? proposedId : null;
  const confidence = Math.min(1, Math.max(0, Number(result.matchConfidence) || 0));
  const newInformation = stringArray(result.newInformation, 20);

  return {
    matchedEventId,
    confidence,
    newInformation,
    fingerprint: {
      eventType: clean(fp.eventType, "unknown"),
      eventDate: clean(fp.eventDate, "unknown"),
      location: clean(fp.location, "unknown"),
      subject: clean(fp.subject, payload.headline),
      canonicalSummary: clean(fp.canonicalSummary, payload.headline),
      actors: stringArray(fp.actors),
      organizations: stringArray(fp.organizations),
      actions: stringArray(fp.actions),
      facts: stringArray(fp.facts, 30),
      numbers: stringArray(fp.numbers),
      quotes: stringArray(fp.quotes, 10)
    }
  };
}

function mergeUnique(existing, additions, limit = 50) {
  return [...new Set([...(existing || []), ...(additions || [])].map((item) => clean(item, "")).filter(Boolean))].slice(0, limit);
}

function makeEventId() {
  return `evt_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

function classifyEvent(match) {
  if (!match.fingerprint) return "bypass";
  if (!match.matchedEventId || match.confidence < EVENT_UPDATE_CONFIDENCE) return "new_event";
  if (match.newInformation.length > 0) return "event_update";
  if (match.confidence >= EVENT_MATCH_CONFIDENCE) return "supporting_coverage";
  return "new_event";
}

function coverageRecord(payload, decision, newInformation) {
  return {
    captureId: payload.captureId,
    sourceName: payload.sourceName,
    platform: payload.platform,
    headline: payload.headline,
    url: payload.finalUrl || payload.originalUrl,
    capturedAt: payload.capturedAt,
    receivedAt: payload.receivedAt,
    decision,
    newInformation,
    recordedAt: nowIso()
  };
}

async function registerEventDecision(rawPayload, payload, match) {
  return withStateLock(async () => {
    const prior = eventState.captureIndex[payload.captureId];
    if (prior) return prior;

    const decision = classifyEvent(match);
    let eventId = match.matchedEventId;
    const timestamp = nowIso();

    if (decision === "new_event") {
      eventId = makeEventId();
      const fp = match.fingerprint;
      eventState.events.push({
        eventId,
        createdAt: timestamp,
        updatedAt: timestamp,
        eventType: fp.eventType,
        eventDate: fp.eventDate,
        location: fp.location,
        subject: fp.subject,
        canonicalSummary: fp.canonicalSummary,
        actors: fp.actors,
        organizations: fp.organizations,
        actions: fp.actions,
        facts: fp.facts,
        numbers: fp.numbers,
        quotes: fp.quotes,
        coverage: [coverageRecord(payload, decision, [])]
      });
    } else if (decision === "event_update" || decision === "supporting_coverage") {
      const event = eventState.events.find((item) => item.eventId === eventId);
      if (!event) {
        eventId = makeEventId();
        const fp = match.fingerprint;
        eventState.events.push({
          eventId,
          createdAt: timestamp,
          updatedAt: timestamp,
          eventType: fp.eventType,
          eventDate: fp.eventDate,
          location: fp.location,
          subject: fp.subject,
          canonicalSummary: fp.canonicalSummary,
          actors: fp.actors,
          organizations: fp.organizations,
          actions: fp.actions,
          facts: fp.facts,
          numbers: fp.numbers,
          quotes: fp.quotes,
          coverage: [coverageRecord(payload, "new_event", [])]
        });
      } else {
        event.updatedAt = timestamp;
        event.actors = mergeUnique(event.actors, match.fingerprint.actors);
        event.organizations = mergeUnique(event.organizations, match.fingerprint.organizations);
        event.actions = mergeUnique(event.actions, match.fingerprint.actions);
        event.facts = mergeUnique(event.facts, match.fingerprint.facts, 100);
        event.numbers = mergeUnique(event.numbers, match.fingerprint.numbers);
        event.quotes = mergeUnique(event.quotes, match.fingerprint.quotes, 30);
        event.coverage.push(coverageRecord(payload, decision, match.newInformation));
        event.coverage = event.coverage.slice(-200);
      }
    }

    const record = {
      captureId: payload.captureId,
      eventId: eventId || null,
      decision,
      matchConfidence: match.confidence,
      newInformation: match.newInformation,
      status: decision === "supporting_coverage" ? "suppressed" : "pending_delivery",
      createdAt: timestamp,
      updatedAt: timestamp,
      deliveryPayload: decision === "supporting_coverage" ? null : payload
    };
    eventState.captureIndex[payload.captureId] = record;
    pruneState();
    await appendCaptureArchive({
      archivedAt: timestamp,
      decision: record,
      rawCapture: rawPayload,
      cleanCapture: payload,
      fingerprint: match.fingerprint
    });
    await saveEventState();
    return record;
  });
}

async function markCaptureDelivered(captureId) {
  await withStateLock(async () => {
    const record = eventState.captureIndex[captureId];
    if (!record) return;
    record.status = "delivered";
    record.deliveryPayload = null;
    record.lastDeliveryError = null;
    record.updatedAt = nowIso();
    await saveEventState();
  });
}

async function markCaptureDeliveryFailed(captureId, error) {
  await withStateLock(async () => {
    const record = eventState.captureIndex[captureId];
    if (!record) return;
    record.status = "pending_delivery";
    record.deliveryAttempts = Number(record.deliveryAttempts || 0) + 1;
    record.lastDeliveryError = error instanceof Error ? error.message : String(error);
    record.updatedAt = nowIso();
    await saveEventState();
  });
}

function pruneState() {
  if (eventState.events.length > EVENT_STORE_MAX_EVENTS) {
    eventState.events.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    eventState.events = eventState.events.slice(0, EVENT_STORE_MAX_EVENTS);
  }
  const entries = Object.entries(eventState.captureIndex);
  if (entries.length > CAPTURE_INDEX_LIMIT) {
    entries.sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt));
    eventState.captureIndex = Object.fromEntries(entries.slice(0, CAPTURE_INDEX_LIMIT));
  }

  const atlasEntries = Object.entries(eventState.atlasForwardIndex || {});
  if (atlasEntries.length > CAPTURE_INDEX_LIMIT) {
    atlasEntries.sort((a, b) => Date.parse(b[1].updatedAt || b[1].createdAt) - Date.parse(a[1].updatedAt || a[1].createdAt));
    eventState.atlasForwardIndex = Object.fromEntries(atlasEntries.slice(0, CAPTURE_INDEX_LIMIT));
  }
}

async function loadEventState() {
  try {
    const text = await fs.readFile(EVENT_STORE_PATH, "utf8");
    const parsed = JSON.parse(text);
    return {
      schemaVersion: "argus.events.v1",
      events: Array.isArray(parsed.events) ? parsed.events : [],
      captureIndex: parsed.captureIndex && typeof parsed.captureIndex === "object" ? parsed.captureIndex : {},
      atlasForwardIndex: parsed.atlasForwardIndex && typeof parsed.atlasForwardIndex === "object" ? parsed.atlasForwardIndex : {}
    };
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("Unable to load event store; starting safely with an empty store", error);
    return { schemaVersion: "argus.events.v1", events: [], captureIndex: {}, atlasForwardIndex: {} };
  }
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function saveEventState() {
  await ensureParent(EVENT_STORE_PATH);
  const tempPath = `${EVENT_STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(eventState, null, 2), "utf8");
  await fs.rename(tempPath, EVENT_STORE_PATH);
}

async function appendCaptureArchive(record) {
  await ensureParent(CAPTURE_ARCHIVE_PATH);
  await fs.appendFile(CAPTURE_ARCHIVE_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

function withStateLock(task) {
  const next = stateWriteChain.then(task, task);
  stateWriteChain = next.catch(() => {});
  return next;
}

function qualityStatus(body, hasImage) {
  if (hasImage) return "🖼 ORIGINAL IMAGE CAPTURED";
  if (body.length < 300) return "🔴 POSSIBLY INCOMPLETE";
  if (body.length < 700) return "🟠 SHORT EXTRACTION";
  return "🟢 NORMAL LENGTH";
}

function splitMessage(text, maxLength = 3900) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf("\n", maxLength);
    if (cut < Math.floor(maxLength * 0.6)) cut = maxLength;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function normalizePayload(input) {
  const payload = input && typeof input === "object" ? input : {};
  const captureId = clean(payload.captureId || payload.taskId, "");
  const body = clean(payload.body, "");
  const imageBase64 = clean(payload.imageBase64, "");
  return {
    schemaVersion: clean(payload.schemaVersion, "argus.raw.v1"),
    eventType: clean(payload.eventType, "raw_news_capture"),
    origin: "samuga_argus",
    collector: "ARGUS",
    collectorVersion: clean(payload.collectorVersion, "unknown"),
    nodeId: clean(payload.nodeId, "argus-android-node"),
    captureId,
    taskId: clean(payload.taskId, captureId),
    sourceName: clean(payload.sourceName, "Unknown source"),
    platform: clean(payload.platform, "unknown").toLowerCase(),
    contentType: clean(payload.contentType, "unknown").toLowerCase(),
    priority: clean(payload.priority, "normal").toLowerCase(),
    alertTypeHint: clean(payload.alertTypeHint, "unknown").toLowerCase(),
    region: clean(payload.region, ""),
    country: clean(payload.country, ""),
    category: clean(payload.category, ""),
    language: clean(payload.language, ""),
    publishedAt: clean(payload.publishedAt || payload.published_at, ""),
    capturedAt: Number(payload.capturedAt || Date.now()),
    receivedAt: clean(payload.receivedAt, nowIso()),
    originalUrl: clean(payload.originalUrl, ""),
    finalUrl: clean(payload.finalUrl, ""),
    headline: clean(payload.headline, ""),
    body,
    imageUrl: clean(payload.imageUrl || payload.image_url, ""),
    imageMimeType: clean(payload.imageMimeType, "image/png"),
    imageFileName: clean(payload.imageFileName, `${captureId || "argus"}.png`),
    imageBase64,
    raw: payload.raw && typeof payload.raw === "object" ? payload.raw : {},
    metadata: {
      ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
      relayReceivedAt: nowIso(),
      rawBodyLength: body.length,
      hasImage: Boolean(imageBase64)
    }
  };
}

function decoratePayload(payload, eventRecord) {
  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      eventIntelligenceStatus: eventRecord.decision,
      eventId: eventRecord.eventId,
      eventMatchConfidence: eventRecord.matchConfidence,
      eventNewInformation: eventRecord.newInformation,
      editorialForwarded: eventRecord.decision !== "supporting_coverage"
    }
  };
}

async function forwardToSamuga(payload) {
  if (!samugaConfigured()) return { configured: false, forwarded: false, status: "not_configured" };
  const response = await fetch(samugaEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-samuga-ingest-secret": SAMUGA_INGEST_SECRET,
      "x-argus-capture-id": payload.captureId
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`Samuga ingest failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  return { configured: true, forwarded: true, status: "accepted", response: data };
}


async function queueAtlasForward(payload) {
  if (!atlasConfigured() || !payload.captureId) return { queued: false, reason: "not_configured" };
  return withStateLock(async () => {
    eventState.atlasForwardIndex ||= {};
    const prior = eventState.atlasForwardIndex[payload.captureId];
    if (prior?.status === "delivered") return { queued: false, reason: "already_delivered" };
    if (!prior) {
      const timestamp = nowIso();
      eventState.atlasForwardIndex[payload.captureId] = {
        captureId: payload.captureId,
        status: "pending",
        payload: buildAtlasPayload(payload),
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        nextRetryAt: timestamp,
        lastError: null,
        atlasJobId: null
      };
      pruneState();
      await saveEventState();
    }
    return { queued: true, reason: prior ? "already_pending" : "queued" };
  });
}

async function forwardAtlasRecord(captureId) {
  if (!atlasConfigured()) return { forwarded: false, status: "not_configured" };
  const record = eventState.atlasForwardIndex?.[captureId];
  if (!record || record.status === "delivered" || !record.payload) return { forwarded: false, status: "not_pending" };

  const response = await fetch(atlasEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-atlas-wire-secret": ATLAS_WIRE_INGEST_SECRET,
      "x-argus-capture-id": captureId
    },
    body: JSON.stringify(record.payload),
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`Atlas Wire ingest failed: HTTP ${response.status} ${JSON.stringify(data)}`);

  await withStateLock(async () => {
    const current = eventState.atlasForwardIndex?.[captureId];
    if (!current) return;
    current.status = "delivered";
    current.updatedAt = nowIso();
    current.deliveredAt = nowIso();
    current.atlasJobId = clean(data?.job_id, "") || current.atlasJobId || null;
    current.lastError = null;
    current.payload = null;
    await saveEventState();
  });
  runtime.atlasForwarded += 1;
  stage("ATLAS_SUCCESS", captureId, `status=${clean(data?.status, "accepted")} job=${clean(data?.job_id, "none")}`);
  return { forwarded: true, status: "accepted", response: data };
}

async function attemptAtlasForward(captureId) {
  const record = eventState.atlasForwardIndex?.[captureId];
  if (!record || record.status === "delivered") return;
  try {
    stage("ATLAS_START", captureId, `endpoint=${atlasEndpoint()}`);
    await forwardAtlasRecord(captureId);
  } catch (error) {
    runtime.atlasFailures += 1;
    await withStateLock(async () => {
      const current = eventState.atlasForwardIndex?.[captureId];
      if (!current || current.status === "delivered") return;
      current.status = "pending";
      current.attempts = Number(current.attempts || 0) + 1;
      current.lastError = error instanceof Error ? error.message : String(error);
      current.updatedAt = nowIso();
      current.nextRetryAt = new Date(Date.now() + atlasRetryDelayMs(current.attempts)).toISOString();
      await saveEventState();
    });
    stageError("ATLAS_FAILED", captureId, error);
  }
}

async function retryPendingAtlas() {
  if (!atlasConfigured()) return;
  const now = Date.now();
  const pending = Object.values(eventState.atlasForwardIndex || {})
    .filter((record) => record?.status === "pending" && record?.payload)
    .filter((record) => !record.nextRetryAt || Date.parse(record.nextRetryAt) <= now)
    .sort((a, b) => Date.parse(a.updatedAt || a.createdAt) - Date.parse(b.updatedAt || b.createdAt))
    .slice(0, ATLAS_RETRY_BATCH);

  for (const record of pending) await attemptAtlasForward(record.captureId);
}

function summaryLines(payload, quality) {
  const eventStatus = clean(payload.metadata?.eventIntelligenceStatus, "pending");
  const cleaningStatus = clean(payload.metadata?.cleaningStatus, "skipped");
  return [
    payload.priority === "urgent_weather" ? "⚠️ ARGUS WEATHER CAPTURE" : "🧹 ARGUS DEEPSEEK CLEAN TEST",
    "",
    `Cleaning: ${cleaningStatus}`,
    `Cleaning model: ${clean(payload.metadata?.cleaningModel, DEEPSEEK_MODEL)}`,
    `Removed lines: ${clean(payload.metadata?.removedLineCount, "0")}`,
    `Event decision: ${eventStatus}`,
    `Event ID: ${clean(payload.metadata?.eventId)}`,
    `Origin: ${payload.origin}`,
    `Node: ${payload.nodeId}`,
    `Source: ${payload.sourceName}`,
    `Platform: ${payload.platform}`,
    `Type: ${payload.contentType}`,
    `Priority: ${payload.priority}`,
    `Received: ${payload.receivedAt}`,
    "",
    `Original URL: ${clean(payload.originalUrl)}`,
    `Final URL: ${clean(payload.finalUrl)}`,
    "",
    `Headline: ${clean(payload.headline)}`,
    `Body length: ${payload.body.length} characters`,
    `Quality: ${quality}`,
    `Capture ID: ${clean(payload.captureId)}`
  ];
}

async function telegramJson(method, body) {
  const response = await fetch(`${TELEGRAM_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  return data;
}

async function sendTelegramBinary(payload, caption, method, fieldName) {
  const bytes = Buffer.from(payload.imageBase64, "base64");
  if (!bytes.length) throw new Error("Decoded image was empty");
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  form.append("caption", caption.slice(0, 1024));
  form.append(fieldName, new Blob([bytes], { type: payload.imageMimeType || "image/png" }), payload.imageFileName || `${payload.captureId}.png`);
  const response = await fetch(`${TELEGRAM_BASE_URL}/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  return data;
}

async function sendTelegramPhoto(payload, caption) {
  try {
    await sendTelegramBinary(payload, caption, "sendPhoto", "photo");
    return { method: "sendPhoto" };
  } catch (photoError) {
    console.warn("sendPhoto failed; retrying original image as document", photoError);
    await sendTelegramBinary(payload, caption, "sendDocument", "document");
    return { method: "sendDocument" };
  }
}

async function sendTelegram(payload) {
  const hasImage = Boolean(payload.imageBase64);
  const quality = qualityStatus(payload.body, hasImage);
  const summary = summaryLines(payload, quality).join("\n");
  let sentPhoto = false;
  let imageDeliveryMethod = "";
  if (hasImage) {
    const mediaResult = await sendTelegramPhoto(payload, summary);
    sentPhoto = true;
    imageDeliveryMethod = mediaResult.method;
  }
  const text = [hasImage ? "Extracted notification/body text:" : summary, "", payload.body || "—"].join("\n");
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i += 1) {
    const prefix = chunks.length > 1 ? `Part ${i + 1}/${chunks.length}\n\n` : "";
    await telegramJson("sendMessage", { chat_id: TELEGRAM_CHAT_ID, text: prefix + chunks[i], disable_web_page_preview: true });
  }
  return { sentParts: chunks.length, sentPhoto, imageDeliveryMethod, quality };
}

async function sendCleaningQuarantineNotice(payload, error) {
  const details = error?.cleaningDetails || {};
  const message = [
    "⚠️ ARGUS EXTRACTION QUARANTINED",
    "",
    "DeepSeek ran twice, but the captured source text was too short or incomplete to treat as a publishable article.",
    "This capture was quarantined so it cannot block newer articles in the Android delivery queue.",
    "",
    `Source: ${clean(payload.sourceName)}`,
    `Headline: ${clean(details.cleanHeadline || payload.headline)}`,
    `Original body length: ${clean(payload.body).length} characters`,
    `Selected body length: ${clean(details.cleanBody).length} characters`,
    `Capture ID: ${clean(payload.captureId)}`,
    `URL: ${clean(payload.finalUrl || payload.originalUrl)}`
  ].join("\n");
  await telegramJson("sendMessage", {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    disable_web_page_preview: true
  });
}

async function sendSupportingCoverageNotice(payload, eventRecord) {
  if (!TELEGRAM_SUPPORTING_COVERAGE) return { sent: false, status: "suppressed_silently" };
  await telegramJson("sendMessage", {
    chat_id: TELEGRAM_CHAT_ID,
    text: [
      "🔗 ARGUS SUPPORTING COVERAGE",
      "",
      `Event ID: ${eventRecord.eventId}`,
      `Source: ${payload.sourceName}`,
      `Headline: ${payload.headline}`,
      `Confidence: ${Math.round(eventRecord.matchConfidence * 100)}%`,
      "Decision: Same event; no meaningful new information. Full article stored but not forwarded to editorial."
    ].join("\n"),
    disable_web_page_preview: true
  });
  return { sent: true, status: "notice_sent" };
}


async function sendRawTelegram(payload) {
  const body = clean(payload.body, "");
  const quality = qualityStatus(body, Boolean(payload.imageBase64));
  const message = [
    "🧪 ARGUS EXTRACTION TEST",
    "",
    `Source: ${clean(payload.sourceName)}`,
    `Platform: ${clean(payload.platform)}`,
    `Type: ${clean(payload.contentType)}`,
    `Received: ${clean(payload.receivedAt)}`,
    "",
    `Original URL: ${clean(payload.originalUrl)}`,
    `Final URL: ${clean(payload.finalUrl)}`,
    "",
    `Headline: ${clean(payload.headline)}`,
    `Body length: ${body.length} characters`,
    `Quality: ${quality}`,
    `Task ID: ${clean(payload.taskId || payload.captureId)}`,
    "",
    "Extracted body:",
    body || "—"
  ].join("\n");

  const chunks = splitMessage(message);
  for (let i = 0; i < chunks.length; i += 1) {
    const prefix = chunks.length > 1 ? `Part ${i + 1}/${chunks.length}\n\n` : "";
    await telegramJson("sendMessage", {
      chat_id: TELEGRAM_CHAT_ID,
      text: prefix + chunks[i],
      disable_web_page_preview: true
    });
  }
  return { sentParts: chunks.length, bodyLength: body.length, quality };
}

async function processIntelligence(rawPayload, precleanedPayload = null, cleaningStatus = "unknown") {
  if (!deepSeekConfigured()) {
    stage("INTELLIGENCE_SKIPPED", rawPayload.captureId, "reason=deepseek_not_configured");
    return;
  }

  try {
    const prior = eventState.captureIndex[rawPayload.captureId];
    if (prior?.status === "delivered" || prior?.status === "suppressed") {
      stage("INTELLIGENCE_ALREADY_PROCESSED", rawPayload.captureId, `decision=${prior.decision}`);
      return;
    }

    stage("EVENT_MATCH_START", rawPayload.captureId);
    const cleanedPayload = precleanedPayload || (await cleanWithDeepSeek(rawPayload)).payload;
    const candidates = recentEventCandidates();
    let match;
    try {
      match = await understandAndMatchEvent(cleanedPayload, candidates);
    } catch (eventError) {
      stageError("EVENT_MATCH_FAILED_OPEN", rawPayload.captureId, eventError);
      match = { matchedEventId: null, confidence: 0, newInformation: [], fingerprint: null };
    }

    const eventRecord = await registerEventDecision(rawPayload, cleanedPayload, match);
    const payload = decoratePayload(cleanedPayload, eventRecord);
    stage("EVENT_DECISION", rawPayload.captureId, `decision=${eventRecord.decision} event=${eventRecord.eventId || "none"}`);

    if (eventRecord.decision === "supporting_coverage") {
      stage("SAMUGA_SUPPRESSED", rawPayload.captureId, "reason=supporting_coverage");
      return;
    }

    if (!samugaConfigured()) {
      stage("SAMUGA_SKIPPED", rawPayload.captureId, "reason=not_configured");
      await markCaptureDeliveryFailed(rawPayload.captureId, new Error("Samuga ingest is not configured"));
      return;
    }

    try {
      stage("SAMUGA_START", rawPayload.captureId, `endpoint=${samugaEndpoint()}`);
      await forwardToSamuga(payload);
      runtime.samugaForwarded += 1;
      await markCaptureDelivered(payload.captureId);
      stage("SAMUGA_SUCCESS", rawPayload.captureId, `decision=${eventRecord.decision}`);
    } catch (forwardError) {
      await markCaptureDeliveryFailed(rawPayload.captureId, forwardError);
      stageError("SAMUGA_FAILED", rawPayload.captureId, forwardError);
    }

    stage("INTELLIGENCE_COMPLETE", rawPayload.captureId, `cleaning=${cleaningStatus} decision=${eventRecord.decision}`);
  } catch (error) {
    stageError("INTELLIGENCE_FAILED", rawPayload.captureId, error);
  }
}

async function retryPendingSamuga() {
  if (!samugaConfigured()) return;
  const pending = Object.values(eventState.captureIndex)
    .filter((record) => record?.status === "pending_delivery" && record?.deliveryPayload)
    .sort((a, b) => Date.parse(a.updatedAt || a.createdAt) - Date.parse(b.updatedAt || b.createdAt))
    .slice(0, SAMUGA_RETRY_BATCH);

  for (const record of pending) {
    const payload = decoratePayload(record.deliveryPayload, record);
    try {
      stage("SAMUGA_RETRY_START", record.captureId, `attempt=${Number(record.deliveryAttempts || 0) + 1}`);
      await forwardToSamuga(payload);
      runtime.samugaForwarded += 1;
      await markCaptureDelivered(record.captureId);
      stage("SAMUGA_RETRY_SUCCESS", record.captureId);
    } catch (error) {
      await markCaptureDeliveryFailed(record.captureId, error);
      stageError("SAMUGA_RETRY_FAILED", record.captureId, error);
    }
  }
}


function argusAuthorized(req) {
  return Boolean(ARGUS_RELAY_SECRET) && (req.get("x-argus-secret") || "") === ARGUS_RELAY_SECRET;
}

function sourceFilters(query = {}) {
  const enabled = query.enabled === undefined ? undefined : parseBoolean(query.enabled, false);
  return {
    enabled,
    platform: clean(query.platform, ""),
    collector: clean(query.collector, ""),
    region: clean(query.region, ""),
    entityId: clean(query.entityId || query.entity_id, ""),
    sourceType: clean(query.sourceType || query.source_type, ""),
    q: clean(query.q, "")
  };
}

app.get("/api/argus/sources", (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const sources = sourceRegistry.list(sourceFilters(req.query));
  res.json({ ok: true, count: sources.length, stats: sourceRegistry.stats(), sources });
});

app.get("/api/argus/sources/stats", (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  res.json({ ok: true, ...sourceRegistry.stats(), storePath: SOURCE_STORE_PATH });
});

app.get("/api/argus/sources/:id", (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const source = sourceRegistry.get(req.params.id);
  if (!source) return res.status(404).json({ ok: false, error: "Source not found" });
  res.json({ ok: true, source });
});

app.post("/api/argus/sources", async (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const source = await sourceRegistry.create(req.body);
    console.log(`[SOURCE_CREATED] id=${source.id} entity=${source.entityId} platform=${source.platform} collector=${source.collector}`);
    return res.status(201).json({ ok: true, source });
  } catch (error) {
    const status = error?.code === "SOURCE_EXISTS" ? 409 : 400;
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.post("/api/argus/sources/import", async (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const contentType = String(req.get("content-type") || "").toLowerCase();
    const sources = contentType.includes("text/csv") || contentType.includes("application/csv")
      ? parseSourceCsv(req.body)
      : Array.isArray(req.body) ? req.body : req.body?.sources;
    if (!Array.isArray(sources)) {
      return res.status(400).json({ ok: false, error: "Send a JSON array, {sources:[...]}, or text/csv" });
    }
    const dryRun = parseBoolean(req.query.dryRun, false);
    const result = await sourceRegistry.import(sources, { dryRun });
    console.log(`[SOURCE_IMPORT] rows=${result.totalRows} created=${result.created} updated=${result.updated} invalid=${result.invalid} dryRun=${dryRun}`);
    return res.status(result.invalid ? 207 : 200).json({ ok: result.invalid === 0, dryRun, ...result, stats: sourceRegistry.stats() });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.patch("/api/argus/sources/:id", async (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const source = await sourceRegistry.update(req.params.id, req.body || {});
    if (!source) return res.status(404).json({ ok: false, error: "Source not found" });
    console.log(`[SOURCE_UPDATED] id=${source.id} enabled=${source.enabled} platform=${source.platform} collector=${source.collector}`);
    return res.json({ ok: true, source });
  } catch (error) {
    const status = error?.code === "SOURCE_EXISTS" ? 409 : 400;
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.delete("/api/argus/sources/:id", async (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const removed = await sourceRegistry.remove(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, error: "Source not found" });
  console.log(`[SOURCE_DELETED] id=${removed.id} entity=${removed.entityId} platform=${removed.platform}`);
  res.json({ ok: true, removed });
});

app.get("/api/argus/collectors/status", (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  res.json({ ok: true, ...serverCollector.status() });
});

app.post("/api/argus/collectors/poll/:id", async (req, res) => {
  if (!argusAuthorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  try {
    const dryRun = parseBoolean(req.query.dryRun, true);
    const result = await serverCollector.pollSourceById(req.params.id, { dryRun });
    console.log(`[COLLECTOR_MANUAL_POLL] source=${req.params.id} dryRun=${dryRun} discovered=${result.discovered || 0} fresh=${result.fresh || 0} submitted=${result.submitted || 0}`);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(error?.message === "Source not found" ? 404 : 400).json({ ok: false, error: error?.message || String(error) });
  }
});

app.get("/", (_req, res) => {
  res.json({
    service: "ARGUS Relay",
    version: "1.6.10-usgs-structured-payload-hotfix",
    status: "online",
    configured: requiredMissing().length === 0,
    samugaForwarding: samugaConfigured(),
    atlasForwarding: atlasConfigured(),
    atlasEndpoint: atlasConfigured() ? atlasEndpoint() : null,
    atlasPending: Object.values(eventState.atlasForwardIndex || {}).filter((record) => record?.status === "pending").length,
    deepSeekCleaning: deepSeekConfigured(),
    deepSeekModel: DEEPSEEK_MODEL,
    eventIntelligence: true,
    eventCount: eventState.events.length,
    eventWindowHours: EVENT_WINDOW_HOURS,
    persistentStore: EVENT_STORE_PATH,
    captureArchive: CAPTURE_ARCHIVE_PATH,
    sourceRegistry: sourceRegistry.stats(),
    sourceStore: SOURCE_STORE_PATH,
    serverCollector: serverCollector.status(),
    runtime
  });
});

app.get("/health", (_req, res) => {
  const missing = requiredMissing();
  res.status(missing.length ? 503 : 200).json({
    ok: missing.length === 0,
    missing,
    samugaForwarding: samugaConfigured(),
    atlasForwarding: atlasConfigured(),
    atlasPending: Object.values(eventState.atlasForwardIndex || {}).filter((record) => record?.status === "pending").length,
    deepSeekCleaning: deepSeekConfigured(),
    deepSeekModel: DEEPSEEK_MODEL,
    eventIntelligence: true,
    eventCount: eventState.events.length,
    storage: { eventStorePath: EVENT_STORE_PATH, captureArchivePath: CAPTURE_ARCHIVE_PATH, sourceStorePath: SOURCE_STORE_PATH },
    sourceRegistry: sourceRegistry.stats(),
    serverCollector: serverCollector.status(),
    runtime
  });
});

app.get("/api/argus/events/stats", (req, res) => {
  if ((req.get("x-argus-secret") || "") !== ARGUS_RELAY_SECRET) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const decisions = Object.values(eventState.captureIndex).reduce((acc, item) => {
    acc[item.decision] = (acc[item.decision] || 0) + 1;
    return acc;
  }, {});
  res.json({ ok: true, eventCount: eventState.events.length, captureCount: Object.keys(eventState.captureIndex).length, decisions });
});

app.post("/api/argus/package", async (req, res) => {
  let captureId = "unknown";
  try {
    const missing = requiredMissing();
    if (missing.length) {
      stage("RECEIVE_REJECTED", captureId, `reason=missing_env names=${missing.join(",")}`);
      return res.status(503).json({ ok: false, error: "Relay not configured", missing });
    }
    if ((req.get("x-argus-secret") || "") !== ARGUS_RELAY_SECRET) {
      stage("RECEIVE_REJECTED", captureId, "reason=unauthorized");
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const rawPayload = normalizePayload(req.body);
    captureId = rawPayload.captureId || "unknown";
    runtime.received += 1;
    stage("ARGUS_RECEIVE", captureId, `source=${JSON.stringify(rawPayload.sourceName)} type=${rawPayload.contentType} body=${rawPayload.body.length}`);
    if (!rawPayload.captureId) {
      return res.status(400).json({ ok: false, error: "captureId/taskId is required" });
    }

    // Clean first, then give Atlas the exact same best-available headline/body
    // that ARGUS validated for its own test surface. This prevents browser/UI
    // labels such as "English News" or image filenames becoming public headlines.
    const cleaning = await cleanWithDeepSeek(rawPayload);
    const cleanedPayload = {
      ...cleaning.payload,
      metadata: {
        ...cleaning.payload.metadata,
        cleaningStatus: cleaning.status,
        cleaningModel: cleaning.payload.metadata?.cleaningModel || DEEPSEEK_MODEL
      }
    };
    runtime.cleaned += 1;
    stage("CLEANING_SUCCESS", captureId, `status=${cleaning.status} headline=${cleanedPayload.headline.length} body=${cleanedPayload.body.length}`);

    if (atlasConfigured()) {
      try {
        const eligibility = atlasEligibility(cleanedPayload);
        if (!eligibility.eligible) {
          stage("ATLAS_SKIPPED", captureId, `reason=${eligibility.reason}`);
        } else {
          const atlasQueued = await queueAtlasForward(cleanedPayload);
          const atlasSource = cleanedPayload.metadata?.deterministicStructured === true
            ? "deterministic_structured"
            : cleaning.status === "skipped" ? "raw_non_article" : "deepseek_cleaned";
          stage("ATLAS_QUEUED", captureId, `reason=${atlasQueued.reason} source=${atlasSource}`);
          setImmediate(() => {
            attemptAtlasForward(cleanedPayload.captureId).catch((error) => stageError("ATLAS_UNHANDLED", cleanedPayload.captureId, error));
          });
        }
      } catch (atlasQueueError) {
        // Atlas bridge persistence failure must never poison ARGUS delivery.
        stageError("ATLAS_QUEUE_FAILED", captureId, atlasQueueError);
      }
    }

    stage("TELEGRAM_START", captureId, `chat=${String(TELEGRAM_CHAT_ID).slice(-6)}`);
    const telegram = await sendTelegram(cleanedPayload);
    runtime.telegramSent += 1;
    stage("TELEGRAM_SUCCESS", captureId, `parts=${telegram.sentParts} photo=${telegram.sentPhoto}`);
    rememberDelivered(rawPayload.captureId);

    res.json({
      ok: true,
      captureId: rawPayload.captureId,
      delivery: "deepseek_cleaned_telegram_confirmed",
      cleaningStatus: cleaning.status,
      telegram,
      intelligenceQueued: true
    });

    setImmediate(() => {
      processIntelligence(rawPayload, cleanedPayload, cleaning.status).catch((error) => {
        stageError("INTELLIGENCE_UNHANDLED", rawPayload.captureId, error);
      });
    });
  } catch (error) {
    if (error?.code === "CLEANING_UNUSABLE" && captureId !== "unknown") {
      try {
        const rawPayload = normalizePayload(req.body);
        stage("CLEANING_QUARANTINED", captureId, `reason=unusable_short_source body=${rawPayload.body.length}`);
        await sendCleaningQuarantineNotice(rawPayload, error);
        rememberDelivered(captureId);
        return res.status(200).json({
          ok: true,
          captureId,
          delivery: "quarantined_not_forwarded",
          cleaningStatus: "quarantined_short_source",
          intelligenceQueued: false
        });
      } catch (quarantineError) {
        stageError("QUARANTINE_NOTICE_FAILED", captureId, quarantineError);
        rememberDelivered(captureId);
        return res.status(200).json({
          ok: true,
          captureId,
          delivery: "quarantined_notice_failed_not_forwarded",
          cleaningStatus: "quarantined_unusable_source",
          intelligenceQueued: false
        });
      }
    }
    stageError("ARGUS_DELIVERY_FAILED", captureId, error);
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        retryable: true,
        stage: runtime.lastStage,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
});

app.post("/api/argus/retry-atlas", async (req, res) => {
  if ((req.get("x-argus-secret") || "") !== ARGUS_RELAY_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  await retryPendingAtlas();
  const pending = Object.values(eventState.atlasForwardIndex || {}).filter((record) => record?.status === "pending").length;
  res.json({ ok: true, configured: atlasConfigured(), pending });
});

app.post("/api/argus/retry-samuga", async (req, res) => {
  if ((req.get("x-argus-secret") || "") !== ARGUS_RELAY_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  await retryPendingSamuga();
  const pending = Object.values(eventState.captureIndex).filter((record) => record?.status === "pending_delivery").length;
  res.json({ ok: true, pending });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ARGUS Relay 1.6.10 usgs-structured-payload-hotfix listening on ${PORT}`);
  console.log(`Event store: ${EVENT_STORE_PATH}`);
  console.log(`Capture archive: ${CAPTURE_ARCHIVE_PATH}`);
  console.log(`Source registry: ${SOURCE_STORE_PATH} (${sourceRegistry.stats().enabled}/${sourceRegistry.stats().total} enabled)`);
  console.log(`Server collectors: ${SERVER_COLLECTORS_ENABLED ? "enabled" : "disabled"} state=${COLLECTOR_STATE_PATH} sources=${serverCollector.status().autoCollectSources}`);
  console.log(`Source pack auto-import: ${SOURCE_PACK_AUTO_IMPORT ? SOURCE_PACK_PATH : "disabled"}`);
  console.log(`World source pack auto-import: ${WORLD_SOURCE_PACK_AUTO_IMPORT ? WORLD_SOURCE_PACK_PATH : "disabled"}`);
  console.log(`DeepSeek model: ${DEEPSEEK_MODEL} (thinking disabled for deterministic low-latency JSON)`);
  console.log(`Samuga endpoint: ${samugaConfigured() ? samugaEndpoint() : "not configured"}`);
  console.log(`Atlas Wire endpoint: ${atlasConfigured() ? atlasEndpoint() : "not configured"}`);
  if (serverCollector.start()) console.log(`[COLLECTOR_SCHEDULER_STARTED] cycle_ms=${COLLECTOR_CYCLE_INTERVAL_MS} concurrency=${COLLECTOR_MAX_CONCURRENCY}`);
  setInterval(() => {
    retryPendingAtlas().catch((error) => stageError("ATLAS_RETRY_LOOP_FAILED", "none", error));
  }, ATLAS_RETRY_INTERVAL_MS).unref();
  setInterval(() => {
    retryPendingSamuga().catch((error) => stageError("SAMUGA_RETRY_LOOP_FAILED", "none", error));
  }, SAMUGA_RETRY_INTERVAL_MS).unref();
});
