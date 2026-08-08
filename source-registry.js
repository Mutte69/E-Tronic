import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SCHEMA_VERSION = "argus.sources.v1";
const ALLOWED_PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const DEFAULT_HEALTH = Object.freeze({
  status: "unknown",
  lastCheckedAt: null,
  lastSuccessAt: null,
  lastError: null,
  consecutiveFailures: 0,
  nextCheckAt: null
});

function nowIso() {
  return new Date().toISOString();
}

function text(value, fallback = "") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function normalizeToken(value, fallback = "other") {
  return text(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function slugify(value, fallback = "source") {
  return text(value, fallback)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || fallback;
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new Error(`Invalid source URL: ${raw}`);
  }
}

function normalizeLanguages(value) {
  const list = Array.isArray(value)
    ? value
    : text(value)
      ? text(value).split(/[|,;]+/)
      : [];
  return [...new Set(list.map((item) => text(item).toLowerCase()).filter(Boolean))].slice(0, 12);
}

function normalizeTags(value) {
  const list = Array.isArray(value)
    ? value
    : text(value)
      ? text(value).split(/[|,;]+/)
      : [];
  return [...new Set(list.map((item) => text(item).toLowerCase()).filter(Boolean))].slice(0, 30);
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

function sourceFingerprint(source) {
  const stable = source.url
    ? `${source.platform}|${source.url.toLowerCase()}`
    : `${source.platform}|${source.entityId}|${source.titleMatch.toLowerCase()}|${source.name.toLowerCase()}`;
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

function makeSourceId(source) {
  const prefix = slugify(source.entityId || source.name);
  const platform = slugify(source.platform, "other");
  return `${prefix}-${platform}-${sourceFingerprint(source).slice(0, 8)}`;
}

function normalizeHealth(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  return {
    status: normalizeToken(input.status, "unknown"),
    lastCheckedAt: text(input.lastCheckedAt) || null,
    lastSuccessAt: text(input.lastSuccessAt) || null,
    lastError: text(input.lastError) || null,
    consecutiveFailures: Math.max(0, Number(input.consecutiveFailures || 0) || 0),
    nextCheckAt: text(input.nextCheckAt) || null
  };
}

function normalizeStringList(value, max = 20) {
  const list = Array.isArray(value)
    ? value
    : text(value)
      ? text(value).split(/[|\n]+/)
      : [];
  return [...new Set(list.map((item) => text(item)).filter(Boolean))].slice(0, max);
}

function normalizeCollectorConfig(value = {}, existing = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const prior = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  const discoveryUrlRaw = input.discoveryUrl ?? input.discovery_url ?? prior.discoveryUrl ?? "";
  const feedUrlRaw = input.feedUrl ?? input.feed_url ?? prior.feedUrl ?? "";
  const mode = normalizeToken(input.mode ?? prior.mode, "auto");
  const bootstrapModeRaw = normalizeToken(input.bootstrapMode ?? input.bootstrap_mode ?? prior.bootstrapMode, "mark_seen");
  const bootstrapMode = ["mark_seen", "publish_latest"].includes(bootstrapModeRaw) ? bootstrapModeRaw : "mark_seen";
  const pollIntervalSeconds = Math.min(86400, Math.max(60, Number(input.pollIntervalSeconds ?? input.poll_interval_seconds ?? prior.pollIntervalSeconds ?? 300) || 300));
  const maxItemsPerPoll = Math.min(25, Math.max(1, Number(input.maxItemsPerPoll ?? input.max_items_per_poll ?? prior.maxItemsPerPoll ?? 5) || 5));
  const maxAgeHours = Math.min(720, Math.max(1, Number(input.maxAgeHours ?? input.max_age_hours ?? prior.maxAgeHours ?? 72) || 72));
  const minCandidateScore = Math.min(20, Math.max(-10, Number(input.minCandidateScore ?? input.min_candidate_score ?? prior.minCandidateScore ?? 3) || 3));
  const minArticleBodyLength = Math.min(5000, Math.max(80, Number(input.minArticleBodyLength ?? input.min_article_body_length ?? prior.minArticleBodyLength ?? 120) || 120));
  const minArticleWords = Math.min(500, Math.max(5, Number(input.minArticleWords ?? input.min_article_words ?? prior.minArticleWords ?? 15) || 15));
  const worldSignalCandidateFloor = Math.min(100, Math.max(0, Number(input.worldSignalCandidateFloor ?? input.world_signal_candidate_floor ?? prior.worldSignalCandidateFloor ?? 25) || 25));
  const worldSignalWatchScore = Math.min(100, Math.max(0, Number(input.worldSignalWatchScore ?? input.world_signal_watch_score ?? prior.worldSignalWatchScore ?? 50) || 50));
  const worldSignalPublishScore = Math.min(100, Math.max(0, Number(input.worldSignalPublishScore ?? input.world_signal_publish_score ?? prior.worldSignalPublishScore ?? 70) || 70));
  const worldSignalCorroborationHours = Math.min(72, Math.max(1, Number(input.worldSignalCorroborationHours ?? input.world_signal_corroboration_hours ?? prior.worldSignalCorroborationHours ?? 12) || 12));
  return {
    mode,
    autoCollect: parseBoolean(input.autoCollect ?? input.auto_collect, prior.autoCollect ?? true),
    bootstrapMode,
    discoveryUrl: discoveryUrlRaw ? normalizeUrl(discoveryUrlRaw) : "",
    feedUrl: feedUrlRaw ? normalizeUrl(feedUrlRaw) : "",
    includeUrlPatterns: normalizeStringList(input.includeUrlPatterns ?? input.include_url_patterns ?? prior.includeUrlPatterns ?? [], 20),
    excludeUrlPatterns: normalizeStringList(input.excludeUrlPatterns ?? input.exclude_url_patterns ?? prior.excludeUrlPatterns ?? [], 30),
    pollIntervalSeconds,
    maxItemsPerPoll,
    maxAgeHours,
    minCandidateScore,
    minArticleBodyLength,
    minArticleWords,
    worldSignalEnabled: parseBoolean(input.worldSignalEnabled ?? input.world_signal_enabled, prior.worldSignalEnabled ?? false),
    worldSignalCandidateFloor,
    worldSignalWatchScore,
    worldSignalPublishScore,
    worldSignalCorroborationHours,
    allowExternalLinks: parseBoolean(input.allowExternalLinks ?? input.allow_external_links, prior.allowExternalLinks ?? false)
  };
}

export function normalizeSource(input, existing = null, { touch = true } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Source must be a JSON object");
  }

  const name = text(input.name ?? existing?.name);
  if (!name) throw new Error("Source name is required");

  const platform = normalizeToken(input.platform ?? existing?.platform, "web");
  const collector = normalizeToken(input.collector ?? existing?.collector ?? platform, platform);
  const sourceType = normalizeToken(input.sourceType ?? input.source_type ?? existing?.sourceType, "other");
  const region = text(input.region ?? existing?.region, "MV").toUpperCase();
  const country = text(input.country ?? existing?.country, region === "MV" ? "MV" : "").toUpperCase();
  const reliability = normalizeToken(input.reliability ?? existing?.reliability, "unknown");
  const rawPriority = text(input.priority ?? existing?.priority, "P2").toUpperCase();
  const priority = ALLOWED_PRIORITIES.has(rawPriority) ? rawPriority : "P2";
  const url = input.url !== undefined ? normalizeUrl(input.url) : text(existing?.url);
  const titleMatch = text(input.titleMatch ?? input.notificationTitleMatch ?? input.notification_title_match ?? existing?.titleMatch);
  const entityId = slugify(input.entityId ?? input.entity_id ?? existing?.entityId ?? name);
  const languages = normalizeLanguages(input.languages ?? input.language ?? existing?.languages ?? []);
  const tags = normalizeTags(input.tags ?? existing?.tags ?? []);
  const notes = text(input.notes ?? existing?.notes);
  const enabled = parseBoolean(input.enabled, existing?.enabled ?? true);
  const collectorConfig = normalizeCollectorConfig(input.collectorConfig ?? input.collector_config ?? existing?.collectorConfig ?? {}, existing?.collectorConfig ?? {});

  const draft = {
    id: text(input.id ?? existing?.id),
    entityId,
    name,
    platform,
    url,
    collector,
    sourceType,
    region,
    country,
    languages,
    priority,
    reliability,
    enabled,
    titleMatch,
    collectorConfig,
    tags,
    notes,
    health: normalizeHealth(input.health ?? existing?.health ?? DEFAULT_HEALTH),
    createdAt: text(existing?.createdAt ?? input.createdAt, nowIso()),
    updatedAt: touch ? nowIso() : text(input.updatedAt ?? existing?.updatedAt, nowIso())
  };
  draft.id = draft.id || makeSourceId(draft);
  return draft;
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (quoted) {
      if (ch === '"' && csvText[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = "";
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => text(item)));
}

export function parseSourceCsv(csvText) {
  const rows = parseCsvRows(String(csvText || ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normalizeToken(header, ""));
  return rows.slice(1).map((values) => {
    const source = {};
    headers.forEach((header, index) => {
      if (header) source[header] = values[index] ?? "";
    });
    return {
      id: source.id,
      entityId: source.entityid || source.entity_id,
      name: source.name || source.source_name,
      platform: source.platform,
      url: source.url,
      collector: source.collector,
      sourceType: source.sourcetype || source.source_type,
      region: source.region,
      country: source.country,
      languages: source.languages || source.language,
      priority: source.priority,
      reliability: source.reliability,
      enabled: source.enabled,
      titleMatch: source.titlematch || source.notification_title_match || source.notificationtitlematch,
      tags: source.tags,
      notes: source.notes,
      collectorConfig: {
        mode: source.collector_mode || source.mode,
        autoCollect: source.auto_collect,
        discoveryUrl: source.discovery_url,
        feedUrl: source.feed_url,
        includeUrlPatterns: source.include_url_patterns,
        excludeUrlPatterns: source.exclude_url_patterns,
        pollIntervalSeconds: source.poll_interval_seconds,
        maxItemsPerPoll: source.max_items_per_poll,
        maxAgeHours: source.max_age_hours,
        minCandidateScore: source.min_candidate_score,
        minArticleBodyLength: source.min_article_body_length,
        minArticleWords: source.min_article_words,
        bootstrapMode: source.bootstrap_mode
      }
    };
  });
}

export class SourceRegistry {
  constructor({ storePath }) {
    this.storePath = storePath;
    this.state = { schemaVersion: DEFAULT_SCHEMA_VERSION, sources: [] };
    this.writeChain = Promise.resolve();
  }

  async load() {
    try {
      const raw = await fs.readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw);
      const inputSources = Array.isArray(parsed) ? parsed : Array.isArray(parsed.sources) ? parsed.sources : [];
      const normalized = [];
      for (const item of inputSources) {
        try { normalized.push(normalizeSource(item, null, { touch: false })); }
        catch (error) { console.warn(`[SOURCE_REGISTRY_SKIP] reason=${JSON.stringify(error.message)}`); }
      }
      this.state = { schemaVersion: DEFAULT_SCHEMA_VERSION, sources: normalized };
    } catch (error) {
      if (error?.code !== "ENOENT") console.error("Unable to load source registry; starting with an empty registry", error);
      this.state = { schemaVersion: DEFAULT_SCHEMA_VERSION, sources: [] };
    }
    return this.state;
  }

  async persist() {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    const temp = `${this.storePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2), "utf8");
    await fs.rename(temp, this.storePath);
  }

  withLock(task) {
    const next = this.writeChain.then(task, task);
    this.writeChain = next.catch(() => {});
    return next;
  }

  list(filters = {}) {
    let sources = [...this.state.sources];
    if (filters.enabled !== undefined) sources = sources.filter((item) => item.enabled === filters.enabled);
    if (filters.platform) sources = sources.filter((item) => item.platform === normalizeToken(filters.platform));
    if (filters.collector) sources = sources.filter((item) => item.collector === normalizeToken(filters.collector));
    if (filters.region) sources = sources.filter((item) => item.region === text(filters.region).toUpperCase());
    if (filters.entityId) sources = sources.filter((item) => item.entityId === slugify(filters.entityId));
    if (filters.sourceType) sources = sources.filter((item) => item.sourceType === normalizeToken(filters.sourceType));
    const q = text(filters.q).toLowerCase();
    if (q) {
      sources = sources.filter((item) => [item.name, item.entityId, item.url, item.platform, item.sourceType, item.titleMatch, ...(item.tags || [])]
        .some((value) => String(value || "").toLowerCase().includes(q)));
    }
    return sources.sort((a, b) => a.name.localeCompare(b.name) || a.platform.localeCompare(b.platform));
  }

  get(id) {
    return this.state.sources.find((item) => item.id === id) || null;
  }

  stats() {
    const byPlatform = {};
    const byCollector = {};
    const byType = {};
    let enabled = 0;
    for (const source of this.state.sources) {
      if (source.enabled) enabled += 1;
      byPlatform[source.platform] = (byPlatform[source.platform] || 0) + 1;
      byCollector[source.collector] = (byCollector[source.collector] || 0) + 1;
      byType[source.sourceType] = (byType[source.sourceType] || 0) + 1;
    }
    return {
      total: this.state.sources.length,
      enabled,
      disabled: this.state.sources.length - enabled,
      entities: new Set(this.state.sources.map((item) => item.entityId)).size,
      byPlatform,
      byCollector,
      byType
    };
  }

  findExisting(source) {
    const byId = source.id ? this.get(source.id) : null;
    if (byId) return byId;
    if (source.url) {
      const url = source.url.toLowerCase();
      return this.state.sources.find((item) => item.platform === source.platform && item.url.toLowerCase() === url) || null;
    }
    if (source.titleMatch) {
      return this.state.sources.find((item) => item.platform === source.platform
        && item.entityId === source.entityId
        && item.titleMatch.toLowerCase() === source.titleMatch.toLowerCase()) || null;
    }
    return null;
  }

  async create(input) {
    return this.withLock(async () => {
      const source = normalizeSource(input);
      const existing = this.findExisting(source);
      if (existing) {
        const error = new Error(`Source already exists: ${existing.id}`);
        error.code = "SOURCE_EXISTS";
        throw error;
      }
      this.state.sources.push(source);
      await this.persist();
      return source;
    });
  }

  async update(id, patch) {
    return this.withLock(async () => {
      const index = this.state.sources.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const existing = this.state.sources[index];
      const updated = normalizeSource({ ...patch, id }, existing);
      const conflict = this.state.sources.find((item, otherIndex) => otherIndex !== index
        && item.platform === updated.platform
        && updated.url
        && item.url.toLowerCase() === updated.url.toLowerCase());
      if (conflict) {
        const error = new Error(`Source URL already exists: ${conflict.id}`);
        error.code = "SOURCE_EXISTS";
        throw error;
      }
      this.state.sources[index] = updated;
      await this.persist();
      return updated;
    });
  }

  async updateHealth(id, patch = {}) {
    return this.withLock(async () => {
      const index = this.state.sources.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const source = this.state.sources[index];
      source.health = normalizeHealth({ ...source.health, ...(patch || {}) });
      source.updatedAt = nowIso();
      await this.persist();
      return source.health;
    });
  }

  async remove(id) {
    return this.withLock(async () => {
      const index = this.state.sources.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const [removed] = this.state.sources.splice(index, 1);
      await this.persist();
      return removed;
    });
  }

  previewImport(inputs) {
    const results = [];
    const pending = [];
    const seenKeys = new Set();
    const seenIds = new Set();
    for (let index = 0; index < inputs.length; index += 1) {
      try {
        const normalized = normalizeSource(inputs[index]);
        const key = normalized.url
          ? `${normalized.platform}|${normalized.url.toLowerCase()}`
          : `${normalized.platform}|${normalized.entityId}|${normalized.titleMatch.toLowerCase()}|${normalized.name.toLowerCase()}`;
        if (seenKeys.has(key) || seenIds.has(normalized.id)) {
          results.push({ index, status: "duplicate_in_import", id: normalized.id, name: normalized.name });
          continue;
        }
        seenKeys.add(key);
        seenIds.add(normalized.id);
        const existing = this.findExisting(normalized);
        pending.push({ index, normalized, existing });
        results.push({ index, status: existing ? "update" : "create", id: existing?.id || normalized.id, name: normalized.name });
      } catch (error) {
        results.push({ index, status: "invalid", error: error.message });
      }
    }
    return { results, pending };
  }

  async import(inputs, { dryRun = false } = {}) {
    if (!Array.isArray(inputs)) throw new Error("Import payload must contain a sources array");
    if (inputs.length > 5000) throw new Error("Import is limited to 5000 sources per request");
    return this.withLock(async () => {
      const preview = this.previewImport(inputs);
      if (dryRun) return this.importSummary(preview.results, false);
      for (const item of preview.pending) {
        if (item.existing) {
          const index = this.state.sources.findIndex((source) => source.id === item.existing.id);
          this.state.sources[index] = normalizeSource({ ...item.normalized, id: item.existing.id }, item.existing);
        } else {
          this.state.sources.push(item.normalized);
        }
      }
      if (preview.pending.length) await this.persist();
      return this.importSummary(preview.results, true);
    });
  }

  importSummary(results, applied) {
    const counts = results.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    return {
      applied,
      totalRows: results.length,
      created: counts.create || 0,
      updated: counts.update || 0,
      invalid: counts.invalid || 0,
      duplicateInImport: counts.duplicate_in_import || 0,
      results
    };
  }
}
