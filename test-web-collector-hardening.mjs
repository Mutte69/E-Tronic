import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceRegistry } from "./source-registry.js";
import { ServerCollector, extractArticleForSource, extractWebCandidates, validateArticle } from "./server-collector.js";

const metConfig = {
  includeUrlPatterns: ["^https://(?:www\\.)?meteorology\\.gov\\.mv/(?:index\\.php/)?single-news/\\d+/?$"],
  excludeUrlPatterns: ["/downloads/", "/climate-data", "/about", "/contact", "/reach-us", "/forecast", "/aviation", "/awareness", "/active_alerts"],
  minCandidateScore: 4,
  minArticleBodyLength: 120,
  minArticleWords: 15
};

const metListing = `<!doctype html><html><body>
<a href="/downloads/463/view">RTI proactive disclosure annual download and information page</a>
<a href="/climate-data">Climate Data Request and long term climate information service</a>
<a href="/about-us">About Maldives Meteorological Service and institutional information</a>
<a href="/single-news/132">Maldives Monthly Climate Outlook for August 2026.</a>
<a href="/single-news/133">Information about El Niño conditions in the Pacific Ocean</a>
<a href="/single-news/131">Maldives Monthly Climate Outlook for July 2026.</a>
</body></html>`;

const metCandidates = extractWebCandidates(metListing, "https://www.meteorology.gov.mv/news", metConfig);
assert.equal(metCandidates.length, 3);
assert.ok(metCandidates.every((item) => /\/single-news\/\d+\/?$/.test(item.url)));
assert.ok(!metCandidates.some((item) => /downloads|climate-data|about-us/.test(item.url)));

// MMS live markup may wrap an image/icon in the article anchor and keep the visible title outside it.
// Explicitly allowlisted news URLs must survive discovery even with empty/short anchor text.
const metCardMarkup = `<!doctype html><html><body>
<a href="/index.php/single-news/132"><img src="/img/outlook.jpg" alt=""></a><h5>Maldives Monthly Climate Outlook for August 2026.</h5>
<a href="/single-news/131"><span aria-hidden="true">→</span></a><h5>Maldives Monthly Climate Outlook for July 2026.</h5>
<a href="/downloads/463/view"><img src="/img/pdf.png" alt=""></a><h5>RTI disclosure</h5>
</body></html>`;
const metCardCandidates = extractWebCandidates(metCardMarkup, "https://www.meteorology.gov.mv/news", metConfig);
assert.equal(metCardCandidates.length, 2);
assert.ok(metCardCandidates.some((item) => item.url.includes("/index.php/single-news/132")));
assert.ok(metCardCandidates.some((item) => item.url.endsWith("/single-news/131")));
assert.ok(!metCardCandidates.some((item) => item.url.includes("/downloads/")));

const serviceOnly = `<!doctype html><html><body>
<a href="/downloads/64/view">MMS Service Charter public document and download information</a>
<a href="/climate-data">Climate data request service information for members of the public</a>
<a href="/reach-us">Reach meteorological offices and service contact information</a>
</body></html>`;
assert.equal(extractWebCandidates(serviceOnly, "https://www.meteorology.gov.mv/news", metConfig).length, 0);

const metSource = { entityId: "mv-met", collectorConfig: metConfig };
const metArticleHtml = `<!doctype html><html><head>
<meta property="og:title" content="Maldives Monthly Climate Outlook for July 2026.">
<link rel="canonical" href="https://www.meteorology.gov.mv/single-news/131">
</head><body>
<h1>Maldives Monthly Climate Outlook for July 2026.</h1>
<div class="published-date">Thu, 9 July 2026</div>
<div class="single-news-content">Rainfall is likely to be normal over the southern atolls and normal to below normal rainfall conditions are expected over central and northern atolls. Both maximum and minimum temperatures are expected to be above normal throughout the Maldives. Maldives Monthly Outlook for July 2026, full report is available here.</div>
<section class="about-section"><h5>About</h5><div>Vision & Mission Who we are Privacy Policy Contact us</div></section>
</body></html>`;
const metArticle = extractArticleForSource(metSource, metArticleHtml, "https://www.meteorology.gov.mv/single-news/131");
assert.equal(metArticle.headline, "Maldives Monthly Climate Outlook for July 2026.");
assert.ok(metArticle.body.includes("Rainfall is likely to be normal"));
assert.ok(!metArticle.body.includes("Vision & Mission"));
assert.equal(validateArticle(metArticle, metConfig).ok, true);

const embeddedStateHtml = `<!doctype html><html><head><script type="application/json">{"props":{"pageProps":{"article":{"title":"Structured state article headline","description":"This deterministic embedded application state contains the complete article body when the visible page shell does not use paragraph tags. It gives ARGUS a non-AI extraction fallback while preserving the source text exactly as supplied by the website."}}}}</script></head><body></body></html>`;
const embedded = extractArticleForSource({ entityId: "other" }, embeddedStateHtml, "https://example.mv/news/9001");
assert.equal(embedded.headline, "Structured state article headline");
assert.ok(embedded.body.includes("deterministic embedded application state"));
assert.equal(validateArticle(embedded, {}).ok, true);

const shellOnly = `<!doctype html><html><body><h1>Maldives Monthly Climate Outlook for August 2026.</h1><div>Sun, 26 July 2026</div><footer>About Vision & Mission Important Links Contact us</footer></body></html>`;
const shell = extractArticleForSource(metSource, shellOnly, "https://www.meteorology.gov.mv/single-news/132");
const shellValidation = validateArticle(shell, metConfig);
assert.equal(shellValidation.ok, false);
assert.match(shellValidation.reason, /body_/);

const thaanaBody = "މިއީ ދިވެހި ބަހުން ލިޔެފައިވާ ޚަބަރެއް ކަމަށް ބެލެވޭ ދިގު މިސާލެއް ކަމަށާއި އެކްސްޓްރެކްޓަރުން ތާނަ އަކުރުތައް ބަދަލު ނުކޮށް ހިމެނޭތޯ ޗެކް ކުރާ ޓެސްޓެކެވެ. މި ޓެކްސްޓް އަދި ދިގުކޮށް ރައްކާތެރި އެކްސްޓްރެކްޝަން ޗެކް ކުރަނީއެވެ.";
const thaanaHtml = `<html><head><meta property="og:title" content="މިއަދުގެ މުހިންމު ޚަބަރެއް"></head><body><article><p>${thaanaBody}</p></article></body></html>`;
const thaana = extractArticleForSource({ entityId: "other" }, thaanaHtml, "https://example.mv/news/dv-2");
assert.equal(thaana.body, thaanaBody);

// A bad article shell must not prevent a later valid candidate from being previewed.
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-met-hardening-"));
const registry = new SourceRegistry({ storePath: path.join(tempDir, "sources.json") });
await registry.load();
const metPollSource = await registry.create({
  name: "Maldives Meteorological Service",
  entityId: "mv-met",
  platform: "web",
  collector: "web",
  url: "https://meteorology.gov.mv/",
  sourceType: "weather",
  priority: "P0",
  reliability: "official",
  collectorConfig: {
    ...metConfig,
    discoveryUrl: "https://meteorology.gov.mv/news",
    bootstrapMode: "publish_latest",
    maxItemsPerPoll: 5,
    maxAgeHours: 720
  }
});
const pollPages = new Map([
  ["https://meteorology.gov.mv/news", metListing],
  ["https://meteorology.gov.mv/single-news/132", shellOnly],
  ["https://meteorology.gov.mv/single-news/133", shellOnly.replace("August 2026.", "Information about El Niño")],
  ["https://meteorology.gov.mv/single-news/131", metArticleHtml]
]);
const pollFetch = async (url) => {
  const key = String(url);
  const body = pollPages.get(key);
  if (!body) return { ok: false, status: 404, url: key, headers: { get: () => "text/html" }, text: async () => "not found" };
  return { ok: true, status: 200, url: key, headers: { get: () => "text/html; charset=utf-8" }, text: async () => body };
};
const pollCollector = new ServerCollector({
  registry,
  statePath: path.join(tempDir, "state.json"),
  enabled: false,
  fetchImpl: pollFetch,
  submitCapture: async () => { throw new Error("dry-run must not submit"); },
  logger: { log() {}, error() {} }
});
await pollCollector.load();
const pollResult = await pollCollector.pollSourceById(metPollSource.id, { dryRun: true });
assert.ok(pollResult.results.some((item) => item.status === "skipped_unusable"));
assert.ok(pollResult.results.some((item) => ["preview", "preview_stale"].includes(item.status) && item.url.endsWith("/single-news/131")));
assert.equal(pollResult.submitted, 0);

console.log("web-collector hardening tests passed");
