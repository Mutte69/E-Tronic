import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceRegistry } from "./source-registry.js";
import { ServerCollector, extractArticleFromHtml, extractWebCandidates, parseRssOrAtom } from "./server-collector.js";

const homepage = `<!doctype html><html><body>
<a href="/about">About us</a>
<a href="/news/2026/08/08/sto-profit-279m">STO reports MVR 279 million profit for second quarter</a>
<a href="/news/2026/08/08/weather-warning">MET issues yellow alert for northern atolls</a>
</body></html>`;

const candidates = extractWebCandidates(homepage, "https://example.mv/", {});
assert.equal(candidates.length, 2);
assert.ok(candidates[0].url.startsWith("https://example.mv/news/"));

const articleHtml = `<!doctype html><html><head>
<meta property="og:title" content="STO reports MVR 279 million profit for second quarter">
<meta property="og:image" content="/img/sto.jpg">
<link rel="canonical" href="https://example.mv/news/2026/08/08/sto-profit-279m">
<script type="application/ld+json">{"@type":"NewsArticle","headline":"STO reports MVR 279 million profit for second quarter","datePublished":"2026-08-08T01:00:00+05:00","articleBody":"State Trading Organisation recorded a profit of MVR 279 million during the second quarter of 2026. The result was MVR 116 million higher than the same period last year."}</script>
</head><body></body></html>`;
const article = extractArticleFromHtml(articleHtml, "https://example.mv/news/2026/08/08/sto-profit-279m");
assert.equal(article.headline, "STO reports MVR 279 million profit for second quarter");
assert.ok(article.body.includes("MVR 279 million"));
assert.equal(article.imageUrl, "https://example.mv/img/sto.jpg");

const thaanaHtml = `<html><head><meta property="og:title" content="މިއަދުގެ މުހިންމު ޚަބަރެއް"></head><body><article><p>މިއީ ދިވެހި ބަހުން ލިޔެފައިވާ ޚަބަރެއް ކަމަށް ބެލެވޭ ދިގު މިސާލެއް ކަމަށާއި އެކްސްޓްރެކްޓަރުން ތާނަ އަކުރުތައް ބަދަލު ނުކޮށް ހިމެނޭތޯ ޗެކް ކުރާ ޓެސްޓެކެވެ.</p></article></body></html>`;
const thaana = extractArticleFromHtml(thaanaHtml, "https://example.mv/news/dv-1");
assert.equal(thaana.headline, "މިއަދުގެ މުހިންމު ޚަބަރެއް");
assert.ok(thaana.body.includes("ތާނަ"));

const rss = `<?xml version="1.0"?><rss><channel><item>
<title><![CDATA[Breaking update]]></title>
<link>https://example.mv/news/1001</link>
<description><![CDATA[This is a complete source report with enough useful article body text for the ARGUS RSS parser to process safely without requiring a page fetch. It contains more than one hundred and sixty characters for this test.]]></description>
<pubDate>Sat, 08 Aug 2026 01:00:00 GMT</pubDate>
</item></channel></rss>`;
const feedItems = parseRssOrAtom(rss, "https://example.mv/feed");
assert.equal(feedItems.length, 1);
assert.equal(feedItems[0].title, "Breaking update");
assert.ok(feedItems[0].body.includes("complete source report"));

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "argus-collector-test-"));
const registry = new SourceRegistry({ storePath: path.join(tempDir, "sources.json") });
await registry.load();
const source = await registry.create({
  name: "Example News",
  entityId: "example-news",
  platform: "web",
  collector: "web",
  url: "https://example.mv/",
  sourceType: "news",
  priority: "P2",
  reliability: "media",
  collectorConfig: { bootstrapMode: "mark_seen", maxItemsPerPoll: 5, pollIntervalSeconds: 60 }
});
assert.equal(source.collectorConfig.bootstrapMode, "mark_seen");

let homepageVersion = 1;
const pageMap = new Map([
  ["https://example.mv/", homepage],
  ["https://example.mv/news/2026/08/08/sto-profit-279m", articleHtml],
  ["https://example.mv/news/2026/08/08/weather-warning", `<html><head><meta property="og:title" content="MET issues yellow alert for northern atolls"></head><body><article><p>Maldives Meteorological Service issued a yellow alert for northern atolls due to strong winds and rough seas. The advisory asks seafarers to exercise caution throughout the warning period.</p></article></body></html>`]
]);

const fakeFetch = async (url) => {
  const key = String(url);
  let body = pageMap.get(key);
  if (key === "https://example.mv/" && homepageVersion === 2) {
    body = homepage.replace("</body>", '<a href="/news/2026/08/08/new-story">A newly published Maldives story with enough headline text</a></body>');
  }
  if (key === "https://example.mv/news/2026/08/08/new-story") {
    body = `<html><head><meta property="og:title" content="A newly published Maldives story with enough headline text"></head><body><article><p>This newly published report contains a valid article paragraph that is long enough to be accepted by the deterministic ARGUS web extractor and forwarded to the normal relay pipeline.</p></article></body></html>`;
  }
  if (!body) return { ok: false, status: 404, url: key, headers: { get: () => "text/html" }, text: async () => "not found" };
  return { ok: true, status: 200, url: key, headers: { get: () => "text/html; charset=utf-8" }, text: async () => body };
};

const submitted = [];
const collector = new ServerCollector({
  registry,
  statePath: path.join(tempDir, "collector-state.json"),
  enabled: false,
  fetchImpl: fakeFetch,
  submitCapture: async (payload) => { submitted.push(payload); return { ok: true, delivery: "accepted" }; },
  logger: { log() {}, error() {} }
});
await collector.load();

const bootstrap = await collector.pollSourceById(source.id, { dryRun: false });
assert.equal(bootstrap.bootstrapped, true);
assert.equal(submitted.length, 0);

homepageVersion = 2;
const second = await collector.pollSourceById(source.id, { dryRun: false });
assert.equal(second.submitted, 1);
assert.equal(submitted.length, 1);
assert.equal(submitted[0].sourceName, "Example News");
assert.equal(submitted[0].metadata.serverCollector, true);
assert.ok(submitted[0].body.includes("deterministic ARGUS web extractor"));

const third = await collector.pollSourceById(source.id, { dryRun: false });
assert.equal(third.submitted, 0);
assert.equal(submitted.length, 1);

console.log("server-collector tests passed");
