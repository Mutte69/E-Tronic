import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { evaluateWorldSignal, correlationSimilarity, isWorldSignalSource } from "./world-signal.js";

const DEFAULT_STATE = Object.freeze({ schemaVersion: "argus.collectors.v1", sources: {}, worldSignals: [] });
const DEFAULT_EXCLUDES = [
  "/tag/", "/tags/", "/category/", "/categories/", "/author/", "/authors/",
  "/search", "/login", "/signup", "/register", "/about", "/contact", "/privacy",
  "/terms", "/advert", "/classified", "/archive", "mailto:", "javascript:"
];
const ARTICLE_PATH_HINTS = /\/(news|press|article|story|updates?|bulletins?|media|local|world|business|politics|economy|sports?)\b/i;
const SERVICE_PATH_HINTS = /\/(downloads?|climate-data|services?|about(?:-us)?|contact(?:-us)?|reach-us|privacy|terms|gallery|careers?|vacanc(?:y|ies)|procurement|tenders?|forecast|aviation|awareness|active_alerts)(?:\/|$)/i;

function nowIso() { return new Date().toISOString(); }
function clamp(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
function hash(value, length = 24) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}
function stripCdata(value = "") {
  return String(value).replace(/^\s*<!\[CDATA\[/i, "").replace(/\]\]>\s*$/i, "");
}
function decodeEntities(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function compactText(value = "") {
  return decodeEntities(stripCdata(value))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag).match(re);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}
function metaContent(html, keys = []) {
  const wanted = new Set(keys.map((x) => x.toLowerCase()));
  for (const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const key = (attr(tag, "property") || attr(tag, "name") || attr(tag, "itemprop")).toLowerCase();
    if (wanted.has(key)) {
      const content = attr(tag, "content");
      if (content) return content;
    }
  }
  return "";
}
function resolveUrl(href, baseUrl) {
  try {
    const value = decodeEntities(String(href || "").trim());
    if (!value || /^(javascript:|mailto:|tel:|#)/i.test(value)) return "";
    const url = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch { return ""; }
}
function compiledPattern(pattern) {
  const raw = String(pattern || "").trim();
  if (!raw) return null;
  const literal = raw.match(/^\/(.*)\/([dgimsuvy]*)$/);
  try { return literal ? new RegExp(literal[1], literal[2] || "i") : new RegExp(raw, "i"); }
  catch { return null; }
}
function onePatternMatches(url, pattern) {
  const regex = compiledPattern(pattern);
  if (regex) return regex.test(url);
  return url.toLowerCase().includes(String(pattern || "").toLowerCase());
}
function patternMatches(url, patterns = []) {
  if (!patterns?.length) return true;
  return patterns.some((pattern) => onePatternMatches(url, pattern));
}
function patternExcluded(url, patterns = []) {
  return [...DEFAULT_EXCLUDES, ...(patterns || [])].some((pattern) => onePatternMatches(url, pattern));
}

export function scoreArticleUrl(url, title = "", config = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { return -100; }
  const pathname = parsed.pathname || "/";
  const depth = pathname.split("/").filter(Boolean).length;
  const cleanTitle = compactText(title);
  let score = 0;
  if (cleanTitle.length >= 45) score += 4;
  else if (cleanTitle.length >= 30) score += 3;
  else if (cleanTitle.length >= 18) score += 2;
  if (depth >= 2) score += 1;
  if (depth >= 3) score += 1;
  if (ARTICLE_PATH_HINTS.test(pathname)) score += 3;
  if (/\/(19|20)\d{2}[/-]/.test(pathname)) score += 2;
  if (/\/\d{2,}(?:\/|$)/.test(pathname)) score += 2;
  if (/[-_][a-z0-9]{3,}[-_][a-z0-9]{3,}/i.test(pathname)) score += 1;
  if (SERVICE_PATH_HINTS.test(pathname)) score -= 8;
  if (/\.(?:pdf|docx?|xlsx?|zip|jpg|jpeg|png|gif|webp)$/i.test(pathname)) score -= 8;
  if (/^(home|read more|more|view all|latest|news|media)$/i.test(cleanTitle)) score -= 5;
  if (config.includeUrlPatterns?.length && patternMatches(url, config.includeUrlPatterns)) score += 4;
  return score;
}

export function extractWebCandidates(html, baseUrl, config = {}) {
  const candidates = [];
  const base = new URL(baseUrl);
  let index = 0;
  const seen = new Set();
  const minScore = clamp(config.minCandidateScore, 3, -10, 20);
  for (const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] ?? match[2] ?? match[3] ?? "";
    const url = resolveUrl(href, baseUrl);
    if (!url || seen.has(url)) continue;
    const parsed = new URL(url);
    if (!config.allowExternalLinks && parsed.hostname !== base.hostname) continue;
    if (url.replace(/\/$/, "") === baseUrl.replace(/\/$/, "")) continue;
    if (patternExcluded(url, config.excludeUrlPatterns)) continue;
    const explicitlyIncluded = Boolean(config.includeUrlPatterns?.length && patternMatches(url, config.includeUrlPatterns));
    if (config.includeUrlPatterns?.length && !explicitlyIncluded) continue;
    const title = compactText(match[4]);
    // Curated include patterns are an explicit source-level allowlist. Some sites (including MMS)
    // wrap only an image/icon in the anchor and render the headline in a sibling element.
    // Do not throw away a strongly allowlisted article URL solely because anchor text is empty;
    // materialization will fetch the article page and extract/validate its real headline/body.
    if (title.length < 12 && !explicitlyIncluded) continue;
    const score = scoreArticleUrl(url, title, config);
    if (score < minScore) continue;
    seen.add(url);
    candidates.push({ url, title, score, index: index++ });
  }
  return candidates.sort((a, b) => b.score - a.score || a.index - b.index);
}

function findJsonLdArticle(html) {
  const scripts = String(html).match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const queue = [];
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try { queue.push(JSON.parse(decodeEntities(raw))); } catch { /* ignore malformed structured data */ }
  }
  while (queue.length) {
    const item = queue.shift();
    if (Array.isArray(item)) { queue.push(...item); continue; }
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
    const type = Array.isArray(item["@type"]) ? item["@type"].join(" ") : String(item["@type"] || "");
    if (/NewsArticle|Article|ReportageNewsArticle/i.test(type)) return item;
  }
  return null;
}


function collectJsonObjects(value, queue = []) {
  if (!value || typeof value !== "object") return queue;
  queue.push(value);
  if (Array.isArray(value)) {
    for (const item of value) collectJsonObjects(item, queue);
  } else {
    for (const child of Object.values(value)) collectJsonObjects(child, queue);
  }
  return queue;
}

function findEmbeddedArticleState(html) {
  const scripts = String(html).match(/<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let parsed;
    try { parsed = JSON.parse(decodeEntities(raw)); } catch { continue; }
    const objects = collectJsonObjects(parsed, []);
    for (const item of objects) {
      if (!item || Array.isArray(item)) continue;
      const headline = compactText(item.headline || item.title || item.name || "");
      const body = compactText(item.articleBody || item.body || item.content || item.description || item.summary || "");
      if (headline.length >= 8 && body.length >= 80) {
        return {
          headline,
          body,
          image: item.image || item.imageUrl || item.featured_image || "",
          datePublished: item.datePublished || item.publishedAt || item.published_at || item.date || ""
        };
      }
    }
  }
  return null;
}

function targetedContentText(html) {
  const fragments = [];
  const re = /<(article|main|section|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of String(html).matchAll(re)) {
    const attrs = String(match[2] || "");
    const identity = `${attr(`<x ${attrs}>`, "class")} ${attr(`<x ${attrs}>`, "id")}`.toLowerCase();
    if (!/(article|news|story|post|detail|content|description|body|editor|wysiwyg)/i.test(identity)) continue;
    if (/(nav|menu|header|footer|sidebar|related|share|social|breadcrumb)/i.test(identity)) continue;
    const paragraphText = paragraphsFrom(match[3]).join("\n\n");
    const text = paragraphText.length >= 100 ? paragraphText : compactText(match[3]);
    if (text.length >= 100) fragments.push(text);
  }
  return [...new Set(fragments)].sort((a, b) => b.length - a.length)[0] || "";
}

function cleanMetBody(value = "") {
  let text = compactText(value)
    .replace(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*/i, "")
    .replace(/^(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*/, "")
    .trim();
  const footerMarkers = ["About\n", "About us", "Important Links", "Stay in touch with us", "© Copyright"];
  let end = text.length;
  for (const marker of footerMarkers) {
    const at = text.indexOf(marker);
    if (at >= 0) end = Math.min(end, at);
  }
  text = text.slice(0, end).replace(/\bRead\s*more\b\.?\s*$/i, "").trim();
  return text;
}

function extractMetFallback(html) {
  const source = String(html || "");
  const h1 = source.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  if (!h1 || h1.index === undefined) return { headline: "", body: "", publishedAt: "" };
  const headline = compactText(h1[0]);
  const tailStart = h1.index + h1[0].length;
  let tail = source.slice(tailStart);
  const endMarkers = [
    /<footer\b/i,
    /<(?:h[1-6]|div|section)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:footer|important-links|about-section)[^"']*["']/i,
    />\s*Important Links\s*</i,
    />\s*Stay in touch with us\s*</i
  ];
  let end = tail.length;
  for (const re of endMarkers) {
    const match = tail.match(re);
    if (match?.index !== undefined) end = Math.min(end, match.index);
  }
  tail = tail.slice(0, end);
  const publishedAt = firstTagText(tail, "time") || compactText(tail).match(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}/i)?.[0] || "";
  return { headline, body: cleanMetBody(tail), publishedAt };
}

const SOURCE_ADAPTERS = [
  {
    name: "mv-met",
    matches(source, url) {
      if (source?.entityId === "mv-met") return true;
      try { return /(^|\.)meteorology\.gov\.mv$/i.test(new URL(url).hostname); }
      catch { return false; }
    },
    extract({ html }) { return extractMetFallback(html); }
  }
];

function sourceAdapter(source, url) {
  return SOURCE_ADAPTERS.find((adapter) => adapter.matches(source, url)) || null;
}

function paragraphsFrom(fragment) {
  const withoutNoise = String(fragment || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ");
  const parts = [...withoutNoise.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => compactText(m[1]))
    .filter((text) => text.length >= 25)
    .filter((text) => !/^(advertisement|subscribe|sign up|read more|follow us|related stories)/i.test(text));
  return [...new Set(parts)].slice(0, 80);
}

function firstTagText(html, tagName) {
  const match = String(html).match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return compactText(match?.[1] || "");
}

export function extractArticleFromHtml(html, url, fallbackTitle = "") {
  const structured = findJsonLdArticle(html);
  const embedded = findEmbeddedArticleState(html);
  const structuredImage = Array.isArray(structured?.image)
    ? structured.image[0]
    : typeof structured?.image === "object" ? structured?.image?.url : structured?.image;
  const embeddedImage = Array.isArray(embedded?.image)
    ? embedded.image[0]
    : typeof embedded?.image === "object" ? embedded?.image?.url : embedded?.image;
  const headline = compactText(structured?.headline || structured?.name || embedded?.headline || "")
    || metaContent(html, ["og:title", "twitter:title"])
    || firstTagText(html, "h1")
    || compactText(fallbackTitle);
  let body = compactText(structured?.articleBody || embedded?.body || "");
  if (body.length < 100) {
    const articleMatch = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    let paragraphs = paragraphsFrom(articleMatch?.[1] || mainMatch?.[1] || "");
    if (paragraphs.join("\n\n").length < 100) paragraphs = paragraphsFrom(html);
    body = paragraphs.join("\n\n");
  }
  if (body.length < 100) body = targetedContentText(html);
  const imageUrl = resolveUrl(structuredImage || embeddedImage || metaContent(html, ["og:image", "twitter:image"]), url);
  const publishedAt = String(structured?.datePublished || embedded?.datePublished || metaContent(html, ["article:published_time", "date", "datepublished"]) || "").trim();
  const canonical = (() => {
    const match = String(html).match(/<link\b[^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i);
    return resolveUrl(match ? attr(match[0], "href") : "", url) || url;
  })();
  return { headline, body, imageUrl, publishedAt, url: canonical };
}

export function extractArticleForSource(source, html, url, fallbackTitle = "") {
  const article = extractArticleFromHtml(html, url, fallbackTitle);
  const adapter = sourceAdapter(source, url);
  if (!adapter) return article;
  const adapted = adapter.extract({ source, html, url, fallbackTitle, article }) || {};
  if ((!article.headline || article.headline.length < 8) && adapted.headline) article.headline = compactText(adapted.headline);
  if (article.body.length < 100 && adapted.body) article.body = compactText(adapted.body);
  if (!article.publishedAt && adapted.publishedAt) article.publishedAt = String(adapted.publishedAt).trim();
  if (!article.imageUrl && adapted.imageUrl) article.imageUrl = resolveUrl(adapted.imageUrl, url);
  return article;
}

export function validateArticle(article, config = {}) {
  const headline = compactText(article?.headline || "");
  const body = compactText(article?.body || "");
  const minBodyLength = clamp(config.minArticleBodyLength, 120, 80, 5000);
  const minWords = clamp(config.minArticleWords, 15, 5, 500);
  const wordCount = body.split(/\s+/u).filter(Boolean).length;
  if (headline.length < 8) return { ok: false, reason: "headline_too_short", bodyLength: body.length, wordCount };
  if (body.length < minBodyLength) return { ok: false, reason: "body_too_short", bodyLength: body.length, wordCount };
  if (wordCount < minWords) return { ok: false, reason: "body_too_few_words", bodyLength: body.length, wordCount };
  if (/^(about|contact|privacy|terms|services?|important links|stay in touch)(?:\s|$)/i.test(body)) {
    return { ok: false, reason: "boilerplate_body", bodyLength: body.length, wordCount };
  }
  return { ok: true, reason: "ok", bodyLength: body.length, wordCount };
}



const MMS_STATIONS = ["Hulhule", "Hanimaadhoo", "Kadhdhoo", "Kaadehdhoo", "Gan"];
const MMS_TIDE_STATIONS = ["Hulhule", "Hanimaadhoo", "Gan"];

function htmlVisibleLines(html) {
  const source = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:h[1-6]|p|div|section|article|main|li|ul|ol|tr|td|th|table|header|footer|aside|nav|option|button)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(source)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean);
}

function indexOfLine(lines, pattern, from = 0) {
  for (let i = Math.max(0, from); i < lines.length; i += 1) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

function fieldFromBlock(lines, label, stopLabels = []) {
  const normalizedLabel = String(label || "").toLowerCase();
  const labels = [label, ...stopLabels].map((item) => String(item || "").toLowerCase());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower === normalizedLabel || lower.startsWith(`${normalizedLabel}:`)) {
      const inline = line.slice(label.length).replace(/^\s*:\s*/, "").trim();
      if (inline) return inline;
      const values = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        const nextLower = next.toLowerCase();
        if (labels.some((candidate) => nextLower === candidate || nextLower.startsWith(`${candidate}:`))) break;
        if (/^(general forecast|marine forecast)$/i.test(next)) break;
        values.push(next);
        if (values.join(" ").length >= 400) break;
      }
      return values.join(" ").trim();
    }
  }
  return "";
}

const MMS_MONTHS = Object.freeze({
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
});

function mmsIsoDateTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\s*(?:\/|,)?\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!match) return "";
  const month = MMS_MONTHS[match[2].toLowerCase()];
  if (!month) return "";
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const meridiem = String(match[6] || "").toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const pad = (n) => String(n).padStart(2, "0");
  return `${match[3]}-${pad(month)}-${pad(match[1])}T${pad(hour)}:${pad(minute)}:00+05:00`;
}

function mmsValidity(value) {
  const text = String(value || "").replace(/^valid\s+from\s*/i, "").trim();
  const parts = text.split(/\s+(?:—|–|to)\s+/i).map((item) => item.trim()).filter(Boolean);
  return {
    raw: text,
    validFrom: mmsIsoDateTime(parts[0] || text),
    validTo: mmsIsoDateTime(parts[1] || "")
  };
}

function forecastEdition(validFrom) {
  if (!validFrom) return "routine";
  const hourMatch = String(validFrom).match(/T(\d{2}):/);
  const hour = Number(hourMatch?.[1]);
  if (!Number.isFinite(hour)) return "routine";
  return hour >= 18 || hour < 5 ? "night" : "day";
}

function parseForecastBlock(lines) {
  const labels = ["Valid from", "Weather", "Winds", "Seas", "Wave Height", "Advisory"];
  const validLine = lines.find((line) => /^Valid from\b/i.test(line)) || "";
  const validRaw = validLine
    ? validLine.replace(/^Valid from\s*:?\s*/i, "").trim()
    : fieldFromBlock(lines, "Valid from", labels.slice(1));
  const validity = mmsValidity(validRaw);
  return {
    validity: validRaw,
    validFrom: validity.validFrom,
    validTo: validity.validTo,
    weather: fieldFromBlock(lines, "Weather", labels.filter((x) => x !== "Weather")),
    winds: fieldFromBlock(lines, "Winds", labels.filter((x) => x !== "Winds")),
    seas: fieldFromBlock(lines, "Seas", labels.filter((x) => x !== "Seas")),
    waveHeight: fieldFromBlock(lines, "Wave Height", labels.filter((x) => x !== "Wave Height")),
    advisory: fieldFromBlock(lines, "Advisory", labels.filter((x) => x !== "Advisory"))
  };
}

function stationPeriod(line = "") {
  const text = String(line || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/^tomorrow$/.test(text)) return "tomorrow";
  if (/^next\s*48\s*(?:hrs?|hours?)$/.test(text)) return "next_48_hours";
  if (/^next\s*72\s*(?:hrs?|hours?)$/.test(text)) return "next_72_hours";
  return "";
}

function extractTemperature(line = "") {
  const match = String(line || "").match(/-?\d{1,2}(?:\.\d+)?\s*°?\s*C\b/i);
  return match ? match[0].replace(/\s+/g, "") : "";
}

function stationOutlook(lines, endIndex = lines.length) {
  const max = endIndex >= 0 ? Math.min(lines.length, endIndex) : lines.length;
  const out = [];
  let period = "";

  // Primary path: MMS exposes explicit Tomorrow / Next 48 hrs / Next 72 hrs groups.
  // Anchoring on those period labels prevents current-observation station widgets elsewhere
  // on the page from being mistaken for forecast outlook cards.
  for (let i = 0; i < max; i += 1) {
    const marker = stationPeriod(lines[i]);
    if (marker) {
      period = marker;
      continue;
    }
    if (/^(general forecast|marine forecast)$/i.test(lines[i])) break;
    if (!period) continue;

    const station = MMS_STATIONS.find((name) => name.toLowerCase() === String(lines[i]).toLowerCase());
    if (!station) continue;

    let temperature = "";
    let condition = "";
    for (let j = i + 1; j < Math.min(max, i + 10); j += 1) {
      const line = lines[j];
      if (stationPeriod(line) || /^(general forecast|marine forecast)$/i.test(line)) break;
      if (MMS_STATIONS.some((name) => name.toLowerCase() === String(line).toLowerCase())) break;

      if (!temperature) {
        temperature = extractTemperature(line);
        if (temperature) {
          const residual = String(line).replace(/-?\d{1,2}(?:\.\d+)?\s*°?\s*C\b/i, " ").trim();
          if (residual && /[A-Za-z]/.test(residual) && !/^(image|select|mph|mm)$/i.test(residual)) condition = residual;
          continue;
        }
      }
      if (temperature && !condition && /[A-Za-z]/.test(line) && !/^(image|select|mph|mm|sea)$/i.test(line)) {
        condition = line;
        break;
      }
    }
    if (temperature && condition && !out.some((item) => item.period === period && item.station === station)) {
      out.push({ period, station, temperature, condition });
    }
  }

  if (out.length) return out;

  // Backward-compatible fallback for older MMS markup that repeated each station three
  // times without retaining the period heading in the visible-text stream.
  const occurrences = Object.fromEntries(MMS_STATIONS.map((name) => [name, 0]));
  const periods = ["tomorrow", "next_48_hours", "next_72_hours"];
  for (let i = 0; i < max; i += 1) {
    const station = MMS_STATIONS.find((name) => name.toLowerCase() === String(lines[i]).toLowerCase());
    if (!station) continue;
    let temperature = "";
    let condition = "";
    for (let j = i + 1; j < Math.min(max, i + 10); j += 1) {
      const line = lines[j];
      if (MMS_STATIONS.some((name) => name.toLowerCase() === String(line).toLowerCase())) break;
      if (!temperature) {
        temperature = extractTemperature(line);
        if (temperature) continue;
      }
      if (temperature && !condition && /[A-Za-z]/.test(line) && !/^(image|select|mph|mm)$/i.test(line)) {
        condition = line;
        break;
      }
    }
    if (!temperature || !condition) continue;
    const idx = occurrences[station]++;
    if (idx >= periods.length) continue;
    out.push({ period: periods[idx], station, temperature, condition });
  }
  return out;
}

function formatForecastBody(data) {
  const lines = [];
  const addBlock = (title, block) => {
    if (!block) return;
    lines.push(title);
    if (block.validity) lines.push(`Valid from ${block.validity}`);
    if (block.weather) lines.push(`Weather: ${block.weather}`);
    if (block.winds) lines.push(`Winds: ${block.winds}`);
    if (block.seas) lines.push(`Seas: ${block.seas}`);
    if (block.waveHeight) lines.push(`Wave Height: ${block.waveHeight}`);
    if (block.advisory) lines.push(`Advisory: ${block.advisory}`);
  };
  addBlock("General Forecast", data.general);
  if (data.marine) {
    if (lines.length) lines.push("");
    addBlock("Marine Forecast", data.marine);
  }
  if (data.stationOutlook?.length) {
    lines.push("", "Station Outlook");
    for (const item of data.stationOutlook) {
      lines.push(`${item.period}: ${item.station} — ${item.temperature} — ${item.condition}`);
    }
  }
  return lines.join("\n").trim();
}

function forecastBlockScore(block) {
  if (!block) return -1;
  const fields = [block.weather, block.winds, block.seas, block.waveHeight, block.advisory].filter(Boolean).length;
  return fields * 10 + (block.validFrom ? 4 : 0) + (block.validTo ? 4 : 0) + (block.validity ? 2 : 0);
}

function bestForecastBlock(lines, headingPattern) {
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (headingPattern.test(lines[i])) starts.push(i);
  }
  let best = null;
  let bestStart = -1;
  let bestScore = -1;
  for (const start of starts) {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^(general forecast|marine forecast)$/i.test(lines[i]) || /^(?:Latest News|In Pictures|Downloads|Footer)$/i.test(lines[i])) {
        end = i;
        break;
      }
    }
    const block = parseForecastBlock(lines.slice(start + 1, end));
    const score = forecastBlockScore(block);
    if (score > bestScore) {
      best = block;
      bestStart = start;
      bestScore = score;
    }
  }
  return { block: bestScore > 0 ? best : null, start: bestStart, score: bestScore };
}

export function parseMetForecastHtml(html) {
  const lines = htmlVisibleLines(html);
  const generalPick = bestForecastBlock(lines, /^General Forecast$/i);
  const marinePick = bestForecastBlock(lines, /^Marine Forecast$/i);
  const general = generalPick.block;
  const marine = marinePick.block;
  if (!general && !marine) return null;

  // Station outlook cards can sit before an early navigation/tab copy of the forecast
  // headings, so parse through the first *contentful* forecast section instead of the
  // first literal heading occurrence.
  const contentStarts = [generalPick.start, marinePick.start].filter((value) => value >= 0);
  const outlookEnd = contentStarts.length ? Math.min(...contentStarts) : lines.length;
  let outlook = stationOutlook(lines, outlookEnd);
  if (!outlook.length) outlook = stationOutlook(lines, lines.length);

  const validFrom = general?.validFrom || marine?.validFrom || "";
  const validTo = general?.validTo || marine?.validTo || "";
  const data = {
    general,
    marine,
    stationOutlook: outlook,
    validFrom,
    validTo,
    edition: forecastEdition(validFrom)
  };
  const meaningful = [general?.weather, general?.winds, general?.seas, general?.waveHeight, marine?.weather, marine?.winds, marine?.seas, marine?.waveHeight].filter(Boolean);
  if (meaningful.length < 3) return null;
  data.body = formatForecastBody(data);
  data.fingerprint = hash(JSON.stringify({ general, marine, stationOutlook: outlook }), 32);
  return data;
}

function normalizeTideStation(value = "") {
  const text = String(value || "").toLowerCase();
  if (/hulhule|hulhule'|hulhumale/.test(text)) return "Hulhule";
  if (/hanimaadhoo/.test(text)) return "Hanimaadhoo";
  if (/\bgan\b|addu/.test(text)) return "Gan";
  return "";
}

function tidePointKey(point) {
  return `${point.station || "unknown"}|${point.time || ""}|${point.height ?? ""}|${point.type || ""}`;
}

function addTidePoint(points, point) {
  const station = normalizeTideStation(point.station || "") || point.station || "";
  const time = compactText(point.time || "");
  const rawHeight = String(point.height ?? "").trim();
  const height = Number(rawHeight.replace(/[^0-9.+-]/g, ""));
  if (!time || !Number.isFinite(height) || Math.abs(height) > 20) return;
  const normalized = { station, time, height, unit: point.unit || "m", type: compactText(point.type || "") };
  const key = tidePointKey(normalized);
  if (!points.some((item) => tidePointKey(item) === key)) points.push(normalized);
}

function tidePointsFromObject(value, inheritedStation = "", points = []) {
  if (!value || typeof value !== "object") return points;
  if (Array.isArray(value)) {
    if (value.length >= 2 && value.length <= 4 && (typeof value[0] === "string" || typeof value[0] === "number") && typeof value[1] === "number") {
      const first = value[0];
      const time = typeof first === "number" && first > 1e11 ? new Date(first).toISOString() : String(first);
      addTidePoint(points, { station: inheritedStation, time, height: value[1] });
    }
    for (const item of value) tidePointsFromObject(item, inheritedStation, points);
    return points;
  }
  const station = normalizeTideStation(value.station || value.location || value.site || value.name || inheritedStation) || inheritedStation;
  const time = value.time ?? value.datetime ?? value.dateTime ?? value.timestamp ?? value.x ?? value.label;
  const height = value.height ?? value.tideHeight ?? value.tide_height ?? value.level ?? value.waterLevel ?? value.water_level ?? value.y;
  if (time !== undefined && height !== undefined) {
    const normalizedTime = typeof time === "number" && time > 1e11 ? new Date(time).toISOString() : String(time);
    addTidePoint(points, { station, time: normalizedTime, height, unit: value.unit || value.units || "m", type: value.type || value.state || value.kind || "" });
  }
  for (const [key, child] of Object.entries(value)) {
    const childStation = normalizeTideStation(key) || station;
    tidePointsFromObject(child, childStation, points);
  }
  return points;
}

function tidePointsFromScripts(html) {
  const points = [];
  const scripts = String(html || "").match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const scriptTag of scripts) {
    const type = attr(scriptTag.match(/^<script\b[^>]*>/i)?.[0] || "", "type").toLowerCase();
    const raw = scriptTag.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    if (type === "application/json" || type === "application/ld+json") {
      try { tidePointsFromObject(JSON.parse(decodeEntities(raw)), "", points); } catch { /* ignore */ }
    }
    if (!/(tide|hulhule|hanimaadhoo|\bgan\b|addu)/i.test(raw)) continue;
    for (const stationName of MMS_TIDE_STATIONS) {
      const re = new RegExp(stationName, "ig");
      for (const match of raw.matchAll(re)) {
        const segment = raw.slice(match.index, Math.min(raw.length, match.index + 24000));
        for (const pair of segment.matchAll(/(?:time|datetime|timestamp|date|x)\s*[:=]\s*["']?([^,"'}\]]+)["']?[\s\S]{0,160}?(?:height|tideHeight|tide_height|level|waterLevel|water_level|value|y)\s*[:=]\s*["']?(-?\d+(?:\.\d+)?)/gi)) {
          addTidePoint(points, { station: stationName, time: pair[1], height: pair[2] });
        }
        for (const pair of segment.matchAll(/\[\s*(1\d{12,})\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g)) {
          addTidePoint(points, { station: stationName, time: new Date(Number(pair[1])).toISOString(), height: pair[2] });
        }
      }
    }
  }
  return points;
}

function tidePointsFromVisibleLines(lines, start, end) {
  const points = [];
  let station = "";
  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    const maybeStation = normalizeTideStation(line);
    if (maybeStation) station = maybeStation;
    const sameLine = line.match(/\b(\d{1,2}:\d{2}(?:\s*[ap]m)?)\b[\s,;|/-]*(high|low)?[\s,;|/-]*(-?\d+(?:\.\d+)?)\s*(m|metres?|meters?)\b/i);
    if (sameLine) addTidePoint(points, { station, time: sameLine[1], type: sameLine[2] || "", height: sameLine[3], unit: "m" });
    if (/^\d{1,2}:\d{2}(?:\s*[ap]m)?$/i.test(line)) {
      for (let j = i + 1; j < Math.min(end, i + 4); j += 1) {
        const heightMatch = lines[j].match(/^(-?\d+(?:\.\d+)?)\s*(m|metres?|meters?)$/i);
        if (heightMatch) {
          addTidePoint(points, { station, time: line, height: heightMatch[1], unit: "m", type: lines[i + 1] && /^(high|low)$/i.test(lines[i + 1]) ? lines[i + 1] : "" });
          break;
        }
      }
    }
  }
  return points;
}

function tideDateIso(label) {
  const text = String(label || "");
  const now = new Date();
  const match = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?,?\s+([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?/i)
    || text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i);
  if (!match) return "";
  let day, monthName, year;
  if (/^\d/.test(match[1])) {
    day = Number(match[1]); monthName = match[2]; year = Number(match[3]);
  } else {
    monthName = match[1]; day = Number(match[2]); year = Number(match[3] || now.getUTCFullYear());
  }
  const month = MMS_MONTHS[String(monthName).toLowerCase()];
  if (!month) return "";
  let candidate = new Date(Date.UTC(year, month - 1, day));
  const diffDays = (candidate.getTime() - now.getTime()) / 86400000;
  if (!match[3] && diffDays > 180) candidate = new Date(Date.UTC(year - 1, month - 1, day));
  if (!match[3] && diffDays < -180) candidate = new Date(Date.UTC(year + 1, month - 1, day));
  return `${candidate.toISOString().slice(0, 10)}T00:00:00+05:00`;
}

function formatTideBody(data) {
  const lines = [];
  if (data.dateLabel) lines.push(`Tide Prediction Chart: ${data.dateLabel}`);
  for (const station of MMS_TIDE_STATIONS) {
    const stationPoints = data.points.filter((point) => point.station === station);
    if (!stationPoints.length) continue;
    lines.push(station);
    for (const point of stationPoints.slice(0, 16)) {
      lines.push(`${point.time} — ${point.height} ${point.unit || "m"}${point.type ? ` — ${point.type}` : ""}`);
    }
  }
  const unknown = data.points.filter((point) => !point.station);
  if (unknown.length) {
    lines.push("Tide values");
    for (const point of unknown.slice(0, 16)) lines.push(`${point.time} — ${point.height} ${point.unit || "m"}${point.type ? ` — ${point.type}` : ""}`);
  }
  return lines.join("\n").trim();
}

export function parseMetTideHtml(html) {
  const lines = htmlVisibleLines(html);
  const start = indexOfLine(lines, /^Tide prediction chart$/i);
  if (start < 0) return null;
  let end = indexOfLine(lines, /^Moon phases$/i, start + 1);
  if (end < 0) end = Math.min(lines.length, start + 160);
  const dateLabel = lines.slice(start + 1, Math.min(end, start + 20)).find((line) => /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?,?\s+[A-Za-z]{3,9}\s+\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/i.test(line)) || "";
  const visible = tidePointsFromVisibleLines(lines, start + 1, end);
  const scripted = tidePointsFromScripts(html);
  const points = [];
  for (const point of [...visible, ...scripted]) addTidePoint(points, point);
  const data = {
    dateLabel,
    publishedAt: tideDateIso(dateLabel),
    stations: MMS_TIDE_STATIONS,
    points: points.slice(0, 64),
    chartDetected: true
  };
  data.body = formatTideBody(data);
  data.fingerprint = hash(JSON.stringify({ dateLabel, points: data.points }), 32);
  data.usable = data.points.length >= 2;
  return data;
}

function forecastArticle(data, url) {
  const validity = data.general?.validity || data.marine?.validity || "current validity";
  return {
    headline: `Maldives Meteorological Service ${data.edition === "night" ? "Night" : "Daily"} Weather Forecast — ${validity}`,
    body: data.body,
    imageUrl: "",
    publishedAt: data.validFrom || "",
    url,
    metForecast: data
  };
}

function tideArticle(data, url) {
  return {
    headline: `Maldives Meteorological Service Tide Prediction${data.dateLabel ? ` — ${data.dateLabel}` : ""}`,
    body: data.body,
    imageUrl: "",
    publishedAt: data.publishedAt || "",
    url,
    metTide: data
  };
}

function capXmlValue(block, name) {
  const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = `(?:[A-Za-z_][\\w.-]*:)?${escaped}`;
  const match = String(block || "").match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return compactText(match?.[1] || "");
}

function capXmlBlocks(block, name) {
  const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = `(?:[A-Za-z_][\\w.-]*:)?${escaped}`;
  return String(block || "").match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi")) || [];
}

function capPairs(block, groupName) {
  return capXmlBlocks(block, groupName).map((group) => ({
    name: capXmlValue(group, "valueName"),
    value: capXmlValue(group, "value")
  })).filter((item) => item.name || item.value);
}

function firstCapInfo(infos = []) {
  if (!infos.length) return null;
  return infos.find((info) => /^en(?:-|$)/i.test(info.language || "")) || infos[0];
}

function detectMmsAlertColor(cap) {
  const values = [
    cap?.info?.headline,
    cap?.info?.event,
    ...(cap?.info?.parameters || []).flatMap((item) => [item.name, item.value]),
    ...(cap?.info?.eventCodes || []).flatMap((item) => [item.name, item.value])
  ].filter(Boolean).join(" ");
  const match = values.match(/\b(white|yellow|orange|red)\s*(?:alert|advisory|warning)?\b/i);
  return match ? match[1].toLowerCase() : "";
}

export function parseCapAlertXml(xml) {
  const source = String(xml || "");
  const alertMatch = source.match(/<(?:[A-Za-z_][\w.-]*:)?alert\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?alert>/i);
  if (!alertMatch) return null;
  const alert = alertMatch[0];
  const infos = capXmlBlocks(alert, "info").map((block) => {
    const areas = capXmlBlocks(block, "area").map((area) => ({
      areaDesc: capXmlValue(area, "areaDesc"),
      polygon: capXmlValue(area, "polygon"),
      circle: capXmlValue(area, "circle"),
      geocodes: capPairs(area, "geocode")
    }));
    return {
      language: capXmlValue(block, "language") || "en-US",
      category: capXmlBlocks(block, "category").map((item) => compactText(item)).filter(Boolean),
      event: capXmlValue(block, "event"),
      responseType: capXmlBlocks(block, "responseType").map((item) => compactText(item)).filter(Boolean),
      urgency: capXmlValue(block, "urgency"),
      severity: capXmlValue(block, "severity"),
      certainty: capXmlValue(block, "certainty"),
      effective: capXmlValue(block, "effective"),
      onset: capXmlValue(block, "onset"),
      expires: capXmlValue(block, "expires"),
      senderName: capXmlValue(block, "senderName"),
      headline: capXmlValue(block, "headline"),
      description: capXmlValue(block, "description"),
      instruction: capXmlValue(block, "instruction"),
      web: capXmlValue(block, "web"),
      contact: capXmlValue(block, "contact"),
      parameters: capPairs(block, "parameter"),
      eventCodes: capPairs(block, "eventCode"),
      areas
    };
  });
  const info = firstCapInfo(infos) || {
    language: "en-US", category: [], event: "", responseType: [], urgency: "", severity: "", certainty: "",
    effective: "", onset: "", expires: "", senderName: "", headline: "", description: "", instruction: "",
    web: "", contact: "", parameters: [], eventCodes: [], areas: []
  };
  const cap = {
    identifier: capXmlValue(alert, "identifier"),
    sender: capXmlValue(alert, "sender"),
    sent: capXmlValue(alert, "sent"),
    status: capXmlValue(alert, "status"),
    msgType: capXmlValue(alert, "msgType"),
    source: capXmlValue(alert, "source"),
    scope: capXmlValue(alert, "scope"),
    restriction: capXmlValue(alert, "restriction"),
    addresses: capXmlValue(alert, "addresses"),
    references: capXmlValue(alert, "references"),
    incidents: capXmlValue(alert, "incidents"),
    info,
    infos
  };
  cap.alertColor = detectMmsAlertColor(cap);
  return cap;
}

function capDisposition(cap) {
  if (!cap) return { actionable: false, reason: "cap_missing" };
  if (!/^actual$/i.test(cap.status || "")) return { actionable: false, reason: `cap_status_${String(cap.status || "unknown").toLowerCase()}` };
  if (!/^public$/i.test(cap.scope || "")) return { actionable: false, reason: `cap_scope_${String(cap.scope || "unknown").toLowerCase()}` };
  if (!/^(alert|update|cancel)$/i.test(cap.msgType || "")) return { actionable: false, reason: `cap_msgtype_${String(cap.msgType || "unknown").toLowerCase()}` };
  return { actionable: true, reason: "cap_actionable" };
}

function capPriority(cap) {
  const color = String(cap?.alertColor || "").toLowerCase();
  if (color === "red") return "urgent";
  if (color === "orange" || color === "yellow") return "high";
  if (color === "white") return "normal";
  const severity = String(cap?.info?.severity || "").toLowerCase();
  const urgency = String(cap?.info?.urgency || "").toLowerCase();
  const certainty = String(cap?.info?.certainty || "").toLowerCase();
  if (severity === "extreme" && ["immediate", "expected"].includes(urgency) && ["observed", "likely"].includes(certainty)) return "urgent";
  if (severity === "severe" && ["immediate", "expected"].includes(urgency)) return "high";
  return "normal";
}

function articleFromCap(cap, url) {
  const info = cap.info || {};
  const areaDescriptions = [...new Set((info.areas || []).map((area) => compactText(area.areaDesc || "")).filter(Boolean))];
  const headline = compactText(info.headline || info.event || `Maldives Meteorological Service ${cap.msgType || "Alert"}`);
  const bodyParts = [];
  if (info.description) bodyParts.push(info.description);
  if (info.instruction) bodyParts.push(`Instruction: ${info.instruction}`);
  if (areaDescriptions.length) bodyParts.push(`Area: ${areaDescriptions.join("; ")}`);
  const start = info.onset || info.effective || cap.sent || "";
  if (start || info.expires) bodyParts.push(`Valid: ${start || "unknown"}${info.expires ? ` — ${info.expires}` : ""}`);
  if (cap.msgType && !/^alert$/i.test(cap.msgType)) bodyParts.push(`CAP message type: ${cap.msgType}`);
  return {
    headline,
    body: bodyParts.join("\n").trim(),
    imageUrl: "",
    publishedAt: cap.sent || info.effective || info.onset || "",
    url: info.web || url,
    cap
  };
}

function candidateSeenKey(candidate) {
  return hash(candidate?.feedId || candidate?.url || "", 32);
}

function capIsStale(article, maxAgeMs) {
  const cap = article?.cap;
  if (!cap) return null;
  const expiresMs = cap.info?.expires ? Date.parse(cap.info.expires) : NaN;
  if (Number.isFinite(expiresMs) && expiresMs >= Date.now()) return false;
  const sentMs = cap.sent ? Date.parse(cap.sent) : NaN;
  if (Number.isFinite(sentMs)) return Date.now() - sentMs > maxAgeMs;
  return false;
}

function xmlValue(block, names) {
  for (const name of names) {
    const match = String(block).match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return compactText(match[1]);
  }
  return "";
}


export function parseUsgsGeoJson(text) {
  let parsed;
  try { parsed = JSON.parse(String(text || "")); } catch { return []; }
  const features = Array.isArray(parsed?.features) ? parsed.features : [];
  return features.map((feature) => {
    const props = feature?.properties || {};
    const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
    const magnitude = Number(props.mag);
    const place = compactText(props.place || "Unknown location");
    const publishedAt = Number.isFinite(Number(props.time)) ? new Date(Number(props.time)).toISOString() : "";
    const updatedAt = Number.isFinite(Number(props.updated)) ? new Date(Number(props.updated)).toISOString() : "";
    const depthKm = Number(coords[2]);
    const earthquake = {
      id: String(feature?.id || props.code || ""),
      magnitude: Number.isFinite(magnitude) ? magnitude : null,
      place,
      time: publishedAt || null,
      updated: updatedAt || null,
      longitude: Number.isFinite(Number(coords[0])) ? Number(coords[0]) : null,
      latitude: Number.isFinite(Number(coords[1])) ? Number(coords[1]) : null,
      depthKm: Number.isFinite(depthKm) ? depthKm : null,
      felt: Number.isFinite(Number(props.felt)) ? Number(props.felt) : null,
      cdi: Number.isFinite(Number(props.cdi)) ? Number(props.cdi) : null,
      mmi: Number.isFinite(Number(props.mmi)) ? Number(props.mmi) : null,
      pagerAlert: compactText(props.alert || "").toLowerCase() || null,
      status: compactText(props.status || "") || null,
      tsunami: Number(props.tsunami) === 1 ? 1 : 0,
      significance: Number.isFinite(Number(props.sig)) ? Number(props.sig) : null,
      eventType: compactText(props.type || "earthquake") || "earthquake",
      detailUrl: compactText(props.detail || "") || null
    };
    const headline = `${Number.isFinite(magnitude) ? `M ${magnitude.toFixed(1)}` : "Earthquake"} - ${place}`;
    const body = [
      Number.isFinite(magnitude) ? `Magnitude: M ${magnitude.toFixed(1)}` : "",
      `Location: ${place}`,
      publishedAt ? `Time: ${publishedAt}` : "",
      Number.isFinite(depthKm) ? `Depth: ${depthKm.toFixed(1)} km` : "",
      earthquake.pagerAlert ? `PAGER alert: ${earthquake.pagerAlert}` : "",
      Number.isFinite(earthquake.mmi) ? `Maximum MMI: ${earthquake.mmi}` : "",
      Number.isFinite(earthquake.felt) ? `Felt reports: ${earthquake.felt}` : "",
      `Tsunami flag: ${earthquake.tsunami ? "yes" : "no"}`,
      Number.isFinite(earthquake.significance) ? `USGS significance: ${earthquake.significance}` : ""
    ].filter(Boolean).join("\n");
    const url = compactText(props.url || props.detail || "");
    const article = { headline, body, imageUrl: "", publishedAt, url, earthquake };
    return {
      url,
      feedId: earthquake.id || url || `${headline}|${publishedAt}`,
      title: headline,
      body,
      publishedAt,
      imageUrl: "",
      mode: "usgs_geojson",
      article
    };
  }).filter((item) => item.url && item.feedId);
}

export function parseRssOrAtom(xml, baseUrl = "") {
  const text = String(xml || "");
  const blocks = text.match(/<item\b[\s\S]*?<\/item>/gi) || text.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => {
    const feedId = xmlValue(block, ["guid", "id"]);
    let link = xmlValue(block, ["link"]);
    if (!link) {
      const linkTag = block.match(/<link\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*\/?\s*>/i);
      link = linkTag?.[1] || linkTag?.[2] || "";
    }
    if (!link) link = feedId;
    const url = resolveUrl(link, baseUrl || link) || link;
    return {
      url,
      feedId: feedId || url,
      title: xmlValue(block, ["title"]),
      body: xmlValue(block, ["content:encoded", "content", "description", "summary"]),
      publishedAt: xmlValue(block, ["pubDate", "published", "updated", "dc:date"]),
      imageUrl: (() => {
        const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0] || "";
        return resolveUrl(attr(enclosure, "url"), baseUrl || url);
      })()
    };
  }).filter((item) => item.url);
}

function priorityToPayload(source) {
  if (source.sourceType === "weather" && source.priority === "P0") return "normal";
  if (source.priority === "P0") return "high";
  if (source.priority === "P1") return "high";
  return "normal";
}

export class ServerCollector {
  constructor({
    registry,
    statePath,
    enabled = false,
    cycleIntervalMs = 60000,
    fetchTimeoutMs = 15000,
    maxConcurrency = 3,
    relayUrl,
    relaySecret,
    userAgent = "ARGUS-Collector/1.0 (+https://samugacreative.com)",
    fetchImpl = globalThis.fetch,
    submitCapture = null,
    logger = console
  }) {
    this.registry = registry;
    this.statePath = statePath;
    this.enabled = Boolean(enabled);
    this.cycleIntervalMs = clamp(cycleIntervalMs, 60000, 30000, 3600000);
    this.fetchTimeoutMs = clamp(fetchTimeoutMs, 15000, 3000, 120000);
    this.maxConcurrency = clamp(maxConcurrency, 3, 1, 12);
    this.relayUrl = String(relayUrl || "").replace(/\/$/, "");
    this.relaySecret = relaySecret || "";
    this.userAgent = userAgent;
    this.fetchImpl = fetchImpl;
    this.submitCapture = submitCapture || ((payload) => this.submitToRelay(payload));
    this.logger = logger;
    this.state = structuredClone(DEFAULT_STATE);
    this.timer = null;
    this.running = false;
    this.runtime = {
      startedAt: null,
      lastCycleAt: null,
      lastCycleCompletedAt: null,
      cycles: 0,
      sourcesPolled: 0,
      itemsDiscovered: 0,
      itemsSubmitted: 0,
      itemsBootstrapped: 0,
      sourceFailures: 0,
      lastError: null
    };
  }

  async load() {
    try {
      const raw = await fs.readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = {
        schemaVersion: "argus.collectors.v1",
        sources: parsed?.sources && typeof parsed.sources === "object" ? parsed.sources : {},
        worldSignals: Array.isArray(parsed?.worldSignals) ? parsed.worldSignals.slice(-1000) : []
      };
    } catch (error) {
      if (error?.code !== "ENOENT") this.logger.error("[COLLECTOR_STATE_LOAD_FAILED]", error);
      this.state = structuredClone(DEFAULT_STATE);
    }
    return this.state;
  }

  async persist() {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2), "utf8");
    await fs.rename(temp, this.statePath);
  }

  sourceState(sourceId) {
    if (!this.state.sources[sourceId]) {
      this.state.sources[sourceId] = { initialized: false, seen: [], lastPollAt: null, lastSuccessAt: null };
    }
    return this.state.sources[sourceId];
  }

  worldSignalCorrelations(source, signal, publishedAt = "") {
    if (!isWorldSignalSource(source) || !signal?.tokens?.length) return [];
    const hours = clamp(source.collectorConfig?.worldSignalCorroborationHours, 12, 1, 72);
    const cutoff = Date.now() - hours * 3600000;
    const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
    const center = Number.isFinite(publishedMs) ? publishedMs : Date.now();
    const matches = [];
    for (const item of this.state.worldSignals || []) {
      if (!item || item.sourceId === source.id || !Array.isArray(item.tokens)) continue;
      const itemMs = Date.parse(item.observedAt || item.publishedAt || "");
      if (!Number.isFinite(itemMs) || itemMs < cutoff || Math.abs(center - itemMs) > hours * 3600000) continue;
      const similarity = correlationSimilarity(signal.tokens, item.tokens);
      const common = signal.tokens.filter((token) => item.tokens.includes(token)).length;
      if (similarity >= 0.28 && common >= 3) matches.push({ sourceId: item.sourceId, similarity, score: item.score || 0 });
    }
    const bestBySource = new Map();
    for (const item of matches) {
      const prior = bestBySource.get(item.sourceId);
      if (!prior || item.similarity > prior.similarity) bestBySource.set(item.sourceId, item);
    }
    return [...bestBySource.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  recordWorldSignal(source, signal, article, candidate) {
    if (!isWorldSignalSource(source) || !signal?.enabled) return;
    if (!Array.isArray(this.state.worldSignals)) this.state.worldSignals = [];
    this.state.worldSignals.push({
      sourceId: source.id,
      entityId: source.entityId,
      observedAt: nowIso(),
      publishedAt: article?.publishedAt || candidate?.publishedAt || null,
      headline: compactText(article?.headline || candidate?.title || "").slice(0, 300),
      url: article?.url || candidate?.url || null,
      score: signal.score,
      decision: signal.decision,
      correlationKey: signal.correlationKey,
      tokens: signal.tokens?.slice(0, 16) || []
    });
    this.state.worldSignals = this.state.worldSignals.slice(-1000);
  }

  status() {
    const sources = this.registry.list({ enabled: true }).filter((source) => ["web", "rss"].includes(source.collector));
    return {
      enabled: this.enabled,
      running: this.running,
      configuredSources: sources.length,
      autoCollectSources: sources.filter((source) => source.collectorConfig?.autoCollect !== false).length,
      cycleIntervalMs: this.cycleIntervalMs,
      fetchTimeoutMs: this.fetchTimeoutMs,
      maxConcurrency: this.maxConcurrency,
      statePath: this.statePath,
      runtime: { ...this.runtime }
    };
  }

  start() {
    if (!this.enabled || this.timer) return false;
    this.runtime.startedAt = nowIso();
    const run = () => this.tick().catch((error) => {
      this.runtime.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`[COLLECTOR_CYCLE_FAILED] error=${JSON.stringify(this.runtime.lastError)}`);
    });
    this.timer = setInterval(run, this.cycleIntervalMs);
    this.timer.unref?.();
    setTimeout(run, 5000).unref?.();
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async fetchText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { "user-agent": this.userAgent, accept: "text/html,application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" },
        redirect: "follow",
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { body, contentType: response.headers?.get?.("content-type") || "", finalUrl: response.url || url };
    } catch (error) {
      if (error?.name === "AbortError") throw new Error(`Fetch timeout after ${this.fetchTimeoutMs}ms`);
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async submitToRelay(payload) {
    if (!this.relayUrl || !this.relaySecret) throw new Error("Collector relay URL/secret is not configured");
    const response = await this.fetchImpl(`${this.relayUrl}/api/argus/package`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-argus-secret": this.relaySecret },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
    if (!response.ok) throw new Error(`Relay ingest HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
    return data;
  }

  async discover(source) {
    const config = source.collectorConfig || {};
    const target = config.feedUrl || config.discoveryUrl || source.url;
    if (!target) throw new Error("Source has no discovery URL");
    const fetched = await this.fetchText(target);

    if (config.mode === "met_forecast") {
      const data = parseMetForecastHtml(fetched.body);
      if (!data) return [];
      const finalUrl = fetched.finalUrl || target;
      const article = forecastArticle(data, finalUrl);
      return [{
        url: finalUrl,
        feedId: `met_forecast_${data.fingerprint}`,
        title: article.headline,
        body: article.body,
        publishedAt: article.publishedAt || "",
        imageUrl: "",
        mode: "met_forecast",
        article
      }];
    }

    if (config.mode === "met_tide") {
      const data = parseMetTideHtml(fetched.body);
      if (!data) return [];
      const finalUrl = fetched.finalUrl || target;
      const article = tideArticle(data, finalUrl);
      return [{
        url: finalUrl,
        feedId: `met_tide_${data.fingerprint}`,
        title: article.headline,
        body: article.body,
        publishedAt: article.publishedAt || "",
        imageUrl: "",
        mode: "met_tide",
        tideUsable: data.usable,
        article
      }];
    }

    if (config.mode === "usgs_geojson") {
      return parseUsgsGeoJson(fetched.body)
        .slice(0, clamp(config.maxItemsPerPoll, 5, 1, 25));
    }

    if (config.mode === "cap") {
      const directCap = parseCapAlertXml(fetched.body);
      if (directCap?.identifier) {
        return [{
          url: fetched.finalUrl || target,
          feedId: directCap.identifier,
          title: directCap.info?.headline || directCap.info?.event || directCap.identifier,
          body: directCap.info?.description || "",
          publishedAt: directCap.sent || "",
          imageUrl: "",
          mode: "cap",
          capXml: fetched.body
        }];
      }
      return parseRssOrAtom(fetched.body, fetched.finalUrl || target)
        .slice(0, clamp(config.maxItemsPerPoll, 5, 1, 25))
        .map((item) => ({ ...item, mode: "cap" }));
    }

    const mode = source.collector === "rss" || config.mode === "rss" || /(?:rss|atom|xml)/i.test(fetched.contentType) ? "rss" : "web";
    if (mode === "rss") {
      return parseRssOrAtom(fetched.body, fetched.finalUrl || target)
        .slice(0, clamp(config.maxItemsPerPoll, 5, 1, 25))
        .map((item) => ({ ...item, mode: "rss" }));
    }
    const candidates = extractWebCandidates(fetched.body, fetched.finalUrl || target, config)
      .slice(0, clamp(config.maxItemsPerPoll, 5, 1, 25));
    return candidates.map((item) => ({ ...item, mode: "web" }));
  }

  async materialize(source, candidate) {
    if (["met_forecast", "met_tide", "usgs_geojson"].includes(candidate.mode) && candidate.article) {
      return candidate.article;
    }

    if (candidate.mode === "cap") {
      let xml = candidate.capXml || "";
      let finalUrl = candidate.url;
      if (!xml) {
        const fetched = await this.fetchText(candidate.url);
        xml = fetched.body;
        finalUrl = fetched.finalUrl || candidate.url;
      }
      const cap = parseCapAlertXml(xml);
      if (!cap?.identifier) throw new Error("CAP alert document missing <alert>/<identifier>");
      return articleFromCap(cap, finalUrl);
    }

    if (candidate.mode === "rss" && candidate.body?.length >= 160) {
      return {
        headline: candidate.title,
        body: candidate.body,
        imageUrl: candidate.imageUrl || "",
        publishedAt: candidate.publishedAt || "",
        url: candidate.url
      };
    }
    const fetched = await this.fetchText(candidate.url);
    const article = extractArticleForSource(source, fetched.body, fetched.finalUrl || candidate.url, candidate.title);
    if (!article.headline) article.headline = candidate.title || "";
    if (article.body.length < 80 && candidate.body?.length >= 80) article.body = candidate.body;
    if (!article.publishedAt) article.publishedAt = candidate.publishedAt || "";
    if (!article.imageUrl) article.imageUrl = candidate.imageUrl || "";
    return article;
  }

  makePayload(source, article) {
    const canonicalUrl = article.url || source.url;

    if (article.metForecast) {
      const forecast = article.metForecast;
      const captureId = `weather_${hash(`${source.id}|${forecast.fingerprint}`)}`;
      return {
        schemaVersion: "argus.raw.v1",
        eventType: "weather_update",
        collectorVersion: "argus-server-collector-1.3-mms-weather",
        nodeId: "argus-relay-server",
        captureId,
        taskId: captureId,
        sourceName: source.name,
        platform: source.platform || "web",
        contentType: "weather_forecast",
        priority: "normal",
        alertTypeHint: "",
        category: "weather",
        country: source.country || "MV",
        language: "en",
        capturedAt: Date.now(),
        receivedAt: nowIso(),
        originalUrl: canonicalUrl,
        finalUrl: canonicalUrl,
        headline: article.headline || "",
        body: article.body || "",
        raw: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          discoveryUrl: source.collectorConfig?.discoveryUrl || source.url,
          metForecast: forecast
        },
        metadata: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          sourceType: source.sourceType,
          sourcePriority: source.priority,
          sourceReliability: source.reliability,
          sourceRegion: source.region,
          sourceCountry: source.country,
          sourceLanguages: source.languages,
          sourceTags: source.tags,
          serverCollector: true,
          deterministicStructured: true,
          publishedAt: article.publishedAt || null,
          imageUrl: null,
          weatherProduct: "mms_routine_forecast",
          forecastEdition: forecast.edition || "routine",
          validFrom: forecast.validFrom || null,
          validTo: forecast.validTo || null,
          generalForecast: forecast.general || null,
          marineForecast: forecast.marine || null,
          stationOutlook: forecast.stationOutlook || [],
          generalWaveHeight: forecast.general?.waveHeight || null,
          marineWaveHeight: forecast.marine?.waveHeight || null
        }
      };
    }

    if (article.metTide) {
      const tide = article.metTide;
      const captureId = `tide_${hash(`${source.id}|${tide.fingerprint}`)}`;
      return {
        schemaVersion: "argus.raw.v1",
        eventType: "tide_update",
        collectorVersion: "argus-server-collector-1.3-mms-weather",
        nodeId: "argus-relay-server",
        captureId,
        taskId: captureId,
        sourceName: source.name,
        platform: source.platform || "web",
        contentType: "tide_forecast",
        priority: "normal",
        alertTypeHint: "",
        category: "weather",
        country: source.country || "MV",
        language: "en",
        capturedAt: Date.now(),
        receivedAt: nowIso(),
        originalUrl: canonicalUrl,
        finalUrl: canonicalUrl,
        headline: article.headline || "",
        body: article.body || "",
        raw: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          discoveryUrl: source.collectorConfig?.discoveryUrl || source.url,
          metTide: tide
        },
        metadata: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          sourceType: source.sourceType,
          sourcePriority: source.priority,
          sourceReliability: source.reliability,
          sourceRegion: source.region,
          sourceCountry: source.country,
          sourceLanguages: source.languages,
          sourceTags: source.tags,
          serverCollector: true,
          deterministicStructured: true,
          publishedAt: article.publishedAt || null,
          imageUrl: null,
          weatherProduct: "mms_tide_prediction",
          tideDateLabel: tide.dateLabel || null,
          tideStations: tide.stations || [],
          tidePoints: tide.points || [],
          tideChartDetected: tide.chartDetected === true
        }
      };
    }

    if (article.cap) {
      const cap = article.cap;
      const info = cap.info || {};
      const capIdentity = `${source.id}|${cap.sender}|${cap.identifier}|${cap.sent}`;
      const captureId = `cap_${hash(capIdentity)}`;
      const areaDescriptions = [...new Set((info.areas || []).map((area) => compactText(area.areaDesc || "")).filter(Boolean))];
      const language = String(info.language || "en").split(/[-_]/)[0].toLowerCase();
      return {
        schemaVersion: "argus.raw.v1",
        eventType: "weather_alert",
        collectorVersion: "argus-server-collector-1.2-cap",
        nodeId: "argus-relay-server",
        captureId,
        taskId: captureId,
        sourceName: source.name,
        platform: source.platform || "rss",
        contentType: "cap_alert",
        priority: capPriority(cap),
        alertTypeHint: cap.alertColor || "",
        category: "weather",
        country: source.country || "MV",
        language,
        capturedAt: Date.now(),
        receivedAt: nowIso(),
        originalUrl: canonicalUrl,
        finalUrl: canonicalUrl,
        headline: article.headline || "",
        body: article.body || "",
        raw: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          feedUrl: source.collectorConfig?.feedUrl || source.url,
          cap
        },
        metadata: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          sourceType: source.sourceType,
          sourcePriority: source.priority,
          sourceReliability: source.reliability,
          sourceRegion: source.region,
          sourceCountry: source.country,
          sourceLanguages: source.languages,
          sourceTags: source.tags,
          serverCollector: true,
          deterministicStructured: true,
          publishedAt: article.publishedAt || null,
          imageUrl: null,
          capIdentifier: cap.identifier || null,
          capSender: cap.sender || null,
          capSent: cap.sent || null,
          capStatus: cap.status || null,
          capMsgType: cap.msgType || null,
          capScope: cap.scope || null,
          capReferences: cap.references || null,
          capIncidents: cap.incidents || null,
          capEvent: info.event || null,
          capUrgency: info.urgency || null,
          capSeverity: info.severity || null,
          capCertainty: info.certainty || null,
          capEffective: info.effective || null,
          capOnset: info.onset || null,
          capExpires: info.expires || null,
          capAreaDescriptions: areaDescriptions,
          capAlertColor: cap.alertColor || null,
          capParameters: info.parameters || [],
          capEventCodes: info.eventCodes || []
        }
      };
    }

    if (article.earthquake) {
      const quake = article.earthquake;
      const captureId = `quake_${hash(`${source.id}|${quake.id || canonicalUrl}|${quake.updated || quake.time || ""}`)}`;
      return {
        schemaVersion: "argus.raw.v1",
        eventType: "earthquake_event",
        collectorVersion: "argus-server-collector-1.4-usgs-geojson",
        nodeId: "argus-relay-server",
        captureId,
        taskId: captureId,
        sourceName: source.name,
        platform: source.platform || "api",
        contentType: "structured_event",
        priority: "high",
        category: "emergency",
        country: source.country || "US",
        language: "en",
        capturedAt: Date.now(),
        receivedAt: nowIso(),
        originalUrl: canonicalUrl,
        finalUrl: canonicalUrl,
        headline: article.headline || "",
        body: article.body || "",
        raw: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          discoveryUrl: source.collectorConfig?.discoveryUrl || source.url,
          earthquake: quake
        },
        metadata: {
          sourceRegistryId: source.id,
          entityId: source.entityId,
          sourceType: source.sourceType,
          sourcePriority: source.priority,
          sourceReliability: source.reliability,
          sourceRegion: source.region,
          sourceCountry: source.country,
          sourceLanguages: source.languages,
          sourceTags: source.tags,
          serverCollector: true,
          deterministicStructured: true,
          publishedAt: article.publishedAt || null,
          imageUrl: null,
          earthquake: quake
        }
      };
    }

    const captureId = `web_${hash(`${source.id}|${canonicalUrl}`)}`;
    return {
      schemaVersion: "argus.raw.v1",
      eventType: "raw_news_capture",
      collectorVersion: "argus-server-collector-1.1",
      nodeId: "argus-relay-server",
      captureId,
      taskId: captureId,
      sourceName: source.name,
      platform: source.platform || "web",
      contentType: "link",
      priority: priorityToPayload(source),
      capturedAt: Date.now(),
      receivedAt: nowIso(),
      originalUrl: canonicalUrl,
      finalUrl: canonicalUrl,
      headline: article.headline || "",
      body: article.body || "",
      raw: { sourceRegistryId: source.id, entityId: source.entityId, discoveryUrl: source.collectorConfig?.discoveryUrl || source.url },
      metadata: {
        sourceRegistryId: source.id,
        entityId: source.entityId,
        sourceType: source.sourceType,
        sourcePriority: source.priority,
        sourceReliability: source.reliability,
        sourceRegion: source.region,
        sourceCountry: source.country,
        sourceLanguages: source.languages,
        sourceTags: source.tags,
        serverCollector: true,
        publishedAt: article.publishedAt || null,
        imageUrl: article.imageUrl || null
      }
    };
  }

  async markHealth(source, ok, error = null) {
    const config = source.collectorConfig || {};
    const now = Date.now();
    const intervalMs = clamp(config.pollIntervalSeconds, 300, 60, 86400) * 1000;
    const nextCheckAt = new Date(now + intervalMs).toISOString();
    const priorFailures = source.health?.consecutiveFailures || 0;
    await this.registry.updateHealth(source.id, ok ? {
      status: "healthy",
      lastCheckedAt: nowIso(),
      lastSuccessAt: nowIso(),
      lastError: null,
      consecutiveFailures: 0,
      nextCheckAt
    } : {
      status: "error",
      lastCheckedAt: nowIso(),
      lastError: error instanceof Error ? error.message : String(error || "Unknown collector error"),
      consecutiveFailures: priorFailures + 1,
      nextCheckAt: new Date(now + Math.min(intervalMs * Math.max(1, priorFailures + 1), 3600000)).toISOString()
    });
  }

  async pollSource(source, { dryRun = false, force = false } = {}) {
    if (!["web", "rss"].includes(source.collector)) throw new Error(`Unsupported server collector: ${source.collector}`);
    if (!source.enabled && !force) return { sourceId: source.id, skipped: true, reason: "disabled" };
    const local = this.sourceState(source.id);
    const seen = new Set(local.seen || []);
    const discovered = await this.discover(source);
    const fresh = discovered.filter((item) => item.url && !seen.has(candidateSeenKey(item)));
    const bootstrap = !local.initialized && source.collectorConfig?.bootstrapMode !== "publish_latest";

    if (bootstrap && !dryRun) {
      for (const item of discovered) seen.add(candidateSeenKey(item));
      local.initialized = true;
      local.seen = [...seen].slice(-2000);
      local.lastPollAt = nowIso();
      local.lastSuccessAt = nowIso();
      await this.persist();
      this.runtime.itemsBootstrapped += discovered.length;
      await this.markHealth(source, true);
      this.logger.log(`[COLLECTOR_BOOTSTRAP] source=${source.id} marked_seen=${discovered.length} dryRun=${dryRun}`);
      return {
        sourceId: source.id,
        mode: discovered[0]?.mode || source.collectorConfig?.mode || source.collector,
        discovered: discovered.length,
        fresh: fresh.length,
        submitted: 0,
        bootstrapped: true,
        dryRun,
        previews: discovered.slice(0, 5)
      };
    }

    const results = [];
    for (const candidate of fresh) {
      const seenKey = candidateSeenKey(candidate);
      try {
        const worldPrefilterEnabled = isWorldSignalSource(source) && source.collectorConfig?.worldSignalEnabled === true;
        if (worldPrefilterEnabled) {
          const candidateSignal = evaluateWorldSignal({
            source,
            article: candidate.article || { headline: candidate.title || "", body: candidate.body || "" },
            phase: "candidate"
          });
          if (candidateSignal.decision === "reject" && candidateSignal.reason === "below_candidate_floor") {
            if (!dryRun) {
              seen.add(seenKey);
              this.recordWorldSignal(source, candidateSignal, null, candidate);
            }
            results.push({
              url: candidate.url,
              status: "world_filtered_pre_ai",
              reason: candidateSignal.reason,
              score: candidateSignal.score,
              headline: candidate.title || "",
              worldSignal: candidateSignal
            });
            continue;
          }
        }

        const article = await this.materialize(source, candidate);
        const isCap = Boolean(article.cap);

        if (article.metTide && !article.metTide.usable) {
          results.push({
            url: candidate.url,
            status: "skipped_tide_unusable",
            reason: "tide_chart_detected_no_numeric_points",
            dateLabel: article.metTide.dateLabel || null,
            pointCount: article.metTide.points?.length || 0,
            retryable: true
          });
          continue;
        }

        if (isCap) {
          const disposition = capDisposition(article.cap);
          if (!disposition.actionable) {
            if (!dryRun) seen.add(seenKey);
            results.push({
              url: candidate.url,
              status: "skipped_cap_non_actionable",
              reason: disposition.reason,
              identifier: article.cap.identifier || null,
              capStatus: article.cap.status || null,
              capMsgType: article.cap.msgType || null,
              capScope: article.cap.scope || null,
              retryable: false
            });
            continue;
          }
        }

        const validation = isCap
          ? (() => {
              const headline = compactText(article.headline || "");
              const body = compactText(article.body || "");
              const wordCount = body.split(/\s+/u).filter(Boolean).length;
              if (!article.cap?.identifier) return { ok: false, reason: "cap_identifier_missing", bodyLength: body.length, wordCount };
              if (headline.length < 5) return { ok: false, reason: "cap_headline_too_short", bodyLength: body.length, wordCount };
              if (body.length < 20) return { ok: false, reason: "cap_body_too_short", bodyLength: body.length, wordCount };
              return { ok: true, reason: "ok", bodyLength: body.length, wordCount };
            })()
          : validateArticle(article, source.collectorConfig || {});

        if (!validation.ok) {
          results.push({
            url: candidate.url,
            status: "skipped_unusable",
            reason: validation.reason,
            headline: article.headline,
            bodyLength: validation.bodyLength,
            wordCount: validation.wordCount,
            retryable: true
          });
          continue;
        }

        const maxAgeMs = clamp(source.collectorConfig?.maxAgeHours, 72, 1, 720) * 3600000;
        const publishedMs = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
        const capStale = isCap ? capIsStale(article, maxAgeMs) : null;
        const isStale = capStale === null
          ? Number.isFinite(publishedMs) && Date.now() - publishedMs > maxAgeMs
          : capStale;
        let worldSignal = null;
        let worldCorrelations = [];
        const worldSignalEnabled = isWorldSignalSource(source) && source.collectorConfig?.worldSignalEnabled === true;
        if (worldSignalEnabled) {
          const initialSignal = evaluateWorldSignal({ source, article, phase: "article" });
          worldCorrelations = this.worldSignalCorrelations(source, initialSignal, article.publishedAt || candidate.publishedAt || "");
          worldSignal = evaluateWorldSignal({
            source,
            article,
            correlatedSources: worldCorrelations.length,
            phase: "article"
          });
        }

        const payload = this.makePayload(source, article);
        if (worldSignal) {
          payload.region = "WORLD";
          payload.category = ["business", "technology", "health", "emergency", "aviation"].includes(source.sourceType)
            ? source.sourceType
            : "world";
          if (worldSignal.score >= 90) payload.priority = "high";
          payload.metadata = {
            ...payload.metadata,
            storyRegion: "world",
            worldSignal: {
              score: worldSignal.score,
              decision: worldSignal.decision,
              reason: worldSignal.reason,
              correlationKey: worldSignal.correlationKey,
              correlatedSources: worldCorrelations,
              reasons: worldSignal.reasons
            }
          };
        }

        if (dryRun) {
          results.push({
            url: candidate.url,
            status: worldSignal && worldSignal.decision !== "pass"
              ? (worldSignal.decision === "watch" ? "world_watch_pre_ai" : "world_filtered_pre_ai")
              : (isStale ? "preview_stale" : "preview"),
            stale: isStale,
            publishedAt: article.publishedAt || null,
            bodyLength: validation.bodyLength,
            wordCount: validation.wordCount,
            ...(worldSignal ? {
              worldSignal: {
                score: worldSignal.score,
                decision: worldSignal.decision,
                reason: worldSignal.reason,
                correlations: worldCorrelations,
                reasons: worldSignal.reasons
              }
            } : {}),
            ...(article.metForecast ? {
              weather: {
                product: "mms_routine_forecast",
                edition: article.metForecast.edition || "routine",
                validFrom: article.metForecast.validFrom || null,
                validTo: article.metForecast.validTo || null,
                generalWaveHeight: article.metForecast.general?.waveHeight || null,
                marineWaveHeight: article.metForecast.marine?.waveHeight || null,
                stationOutlookCount: article.metForecast.stationOutlook?.length || 0
              }
            } : {}),
            ...(article.metTide ? {
              tide: {
                product: "mms_tide_prediction",
                dateLabel: article.metTide.dateLabel || null,
                pointCount: article.metTide.points?.length || 0,
                stations: [...new Set((article.metTide.points || []).map((point) => point.station).filter(Boolean))]
              }
            } : {}),
            ...(isCap ? {
              cap: {
                identifier: article.cap.identifier || null,
                status: article.cap.status || null,
                msgType: article.cap.msgType || null,
                scope: article.cap.scope || null,
                event: article.cap.info?.event || null,
                severity: article.cap.info?.severity || null,
                urgency: article.cap.info?.urgency || null,
                certainty: article.cap.info?.certainty || null,
                alertColor: article.cap.alertColor || null,
                areas: (article.cap.info?.areas || []).map((area) => area.areaDesc).filter(Boolean),
                expires: article.cap.info?.expires || null,
                references: article.cap.references || null
              }
            } : {}),
            payload: { ...payload, body: payload.body.slice(0, 800) }
          });
          continue;
        }

        if (isStale) {
          seen.add(seenKey);
          results.push({
            url: candidate.url,
            status: "skipped_stale",
            publishedAt: article.publishedAt,
            identifier: article.cap?.identifier || null
          });
          continue;
        }

        if (worldSignal && worldSignal.decision !== "pass") {
          seen.add(seenKey);
          this.recordWorldSignal(source, worldSignal, article, candidate);
          results.push({
            url: candidate.url,
            status: worldSignal.decision === "watch" ? "world_watch_pre_ai" : "world_filtered_pre_ai",
            score: worldSignal.score,
            reason: worldSignal.reason,
            correlationKey: worldSignal.correlationKey,
            correlatedSources: worldCorrelations.map((item) => item.sourceId)
          });
          this.logger.log(`[WORLD_SIGNAL_${worldSignal.decision.toUpperCase()}] source=${source.id} score=${worldSignal.score} reason=${worldSignal.reason} url=${candidate.url}`);
          continue;
        }

        if (worldSignal) {
          this.recordWorldSignal(source, worldSignal, article, candidate);
          this.logger.log(`[WORLD_SIGNAL_PASS] source=${source.id} score=${worldSignal.score} reason=${worldSignal.reason} correlations=${worldCorrelations.length} url=${candidate.url}`);
        }

        const response = await this.submitCapture(payload);
        seen.add(seenKey);
        results.push({ url: candidate.url, status: "submitted", captureId: payload.captureId, relay: response?.delivery || "accepted" });
        this.runtime.itemsSubmitted += 1;
      } catch (error) {
        results.push({ url: candidate.url, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (!dryRun) {
      local.initialized = true;
      local.seen = [...seen].slice(-2000);
      local.lastPollAt = nowIso();
      local.lastSuccessAt = nowIso();
      await this.persist();
      const failed = results.filter((item) => item.status === "failed");
      if (failed.length && failed.length === fresh.length) {
        await this.markHealth(source, false, new Error(`All ${failed.length} fresh candidates failed`));
      } else {
        await this.markHealth(source, true);
      }
    }
    return {
      sourceId: source.id,
      mode: discovered[0]?.mode || source.collectorConfig?.mode || source.collector,
      discovered: discovered.length,
      fresh: fresh.length,
      submitted: results.filter((x) => x.status === "submitted").length,
      failed: results.filter((x) => x.status === "failed").length,
      dryRun,
      results
    };
  }

  async pollSourceById(id, options = {}) {
    const source = this.registry.get(id);
    if (!source) throw new Error("Source not found");
    return this.pollSource(source, { ...options, force: true });
  }

  dueSources() {
    const now = Date.now();
    return this.registry.list({ enabled: true })
      .filter((source) => ["web", "rss"].includes(source.collector))
      .filter((source) => source.collectorConfig?.autoCollect !== false)
      .filter((source) => !source.health?.nextCheckAt || Date.parse(source.health.nextCheckAt) <= now);
  }

  async tick() {
    if (!this.enabled || this.running) return { skipped: true };
    this.running = true;
    this.runtime.lastCycleAt = nowIso();
    this.runtime.cycles += 1;
    const sources = this.dueSources();
    let cursor = 0;
    const worker = async () => {
      while (cursor < sources.length) {
        const source = sources[cursor++];
        try {
          this.logger.log(`[COLLECTOR_POLL_START] source=${source.id} name=${JSON.stringify(source.name)}`);
          const result = await this.pollSource(source);
          this.runtime.sourcesPolled += 1;
          this.runtime.itemsDiscovered += result.discovered || 0;
          this.logger.log(`[COLLECTOR_POLL_SUCCESS] source=${source.id} discovered=${result.discovered || 0} fresh=${result.fresh || 0} submitted=${result.submitted || 0} bootstrap=${Boolean(result.bootstrapped)}`);
        } catch (error) {
          this.runtime.sourceFailures += 1;
          this.runtime.lastError = error instanceof Error ? error.message : String(error);
          try { await this.markHealth(source, false, error); } catch { /* health persistence must not kill cycle */ }
          this.logger.error(`[COLLECTOR_POLL_FAILED] source=${source.id} error=${JSON.stringify(this.runtime.lastError)}`);
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(this.maxConcurrency, Math.max(1, sources.length)) }, worker));
      return { sources: sources.length };
    } finally {
      this.runtime.lastCycleCompletedAt = nowIso();
      this.running = false;
    }
  }
}
