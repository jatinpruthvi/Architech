#!/usr/bin/env node
/* On-page SEO audit against RENDERED HTML.
 *
 * Why this exists. The repo already had strong SEO gates -- a page registry,
 * sitemap contracts, a crawl simulator, structured-data helpers -- and all of
 * them passed while four real on-page defects were live:
 *
 *   - rent titles at 72 chars reading "... | Architech · Architech"
 *   - a 180-character meta description truncated mid-sentence in the SERP
 *   - every city hub shipping a bare 28-character title, ~20 characters of
 *     the strongest ranking real estate on the page left unused
 *
 * Every one of those passed typecheck, lint, and the unit suite, because unit
 * tests measure helper OUTPUT and none of them measured the string a searcher
 * actually sees after the layout's title template is applied. This script
 * closes that gap: it fetches real pages and measures the real `<title>`,
 * `<meta name="description">`, and heading structure.
 *
 * Derived from the on-page checks in the prompts.chat SEO prompts (see
 * docs/seo/onpage-audit-2026-09-07.md for the provenance and the adaptation
 * log). The generic checks are kept; the ones that would force this repo to
 * invent facts -- keyword density targets, "keyword in first 100 words",
 * word-count minimums -- are deliberately omitted, because Architech's rule is
 * that copy states verified facts and nothing else.
 *
 * Usage: node scripts/seo/onpage-audit.mjs [--base http://localhost:PORT]
 * Exits non-zero when any indexable page breaks a budget. */

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
/* `--base` only. An env var would have to be registered in the operations env
   catalog (a governance contract for RUNTIME configuration), and this is a
   dev/CI script, not runtime config. The flag covers every caller. */
const BASE = baseArg !== -1 ? args[baseArg + 1] : "http://127.0.0.1:3000";

/* Budgets. Google truncates titles around 60 characters and descriptions
   around 155-160; the repo's own serp.ts already uses these numbers, so they
   are read as constants rather than re-invented here. */
const TITLE_MAX = 60;
const DESC_MAX = 160;
/* Below this a description is not "wrong", but it is leaving SERP space on the
   table -- worth reporting as a warning, never a failure. */
const DESC_MIN_USEFUL = 80;
const TITLE_MIN_USEFUL = 30;

const strip = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* Titles and descriptions are HTML-encoded in the source. Google counts the
   DECODED characters, so "&amp;" is one character to a searcher and five to a
   naive regex -- measuring the raw string reports phantom overflows. */
const decode = (text) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

async function auditPage(path) {
  const res = await fetch(new URL(path, BASE));
  const html = await res.text();

  const robots = (html.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
  const noindex = /noindex/i.test(robots);

  const title = decode((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "");
  const description = decode((html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "");
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1]));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((tag) => !/\balt=/i.test(tag));

  return { path, status: res.status, noindex, title, description, canonical, h1s, imgCount: imgs.length, imgsNoAlt: imgsNoAlt.length };
}

function check(page) {
  const errors = [];
  const warnings = [];

  if (page.status !== 200) errors.push(`HTTP ${page.status}`);

  /* Everything below is an INDEXING concern. A noindex page (search results,
     PIN pages behind their source gate) is exempt by design -- flagging it
     would be noise that trains people to ignore the audit. */
  if (page.noindex) return { errors, warnings, skipped: true };

  if (!page.title) errors.push("missing <title>");
  else {
    if (page.title.length > TITLE_MAX) errors.push(`title ${page.title.length} chars (max ${TITLE_MAX}) — will truncate in SERP`);
    if (/architech.*architech/i.test(page.title)) errors.push(`brand appears twice in title: ${JSON.stringify(page.title)}`);
    if (page.title.length < TITLE_MIN_USEFUL) warnings.push(`title only ${page.title.length} chars — unused SERP space`);
  }

  if (!page.description) errors.push("missing meta description");
  else {
    if (page.description.length > DESC_MAX) errors.push(`description ${page.description.length} chars (max ${DESC_MAX}) — truncates mid-sentence`);
    if (page.description.length < DESC_MIN_USEFUL) warnings.push(`description only ${page.description.length} chars — unused SERP space`);
  }

  if (!page.canonical) errors.push("missing canonical");

  /* One H1 per document: zero leaves the page's topic unstated, more than one
     splits it. */
  if (page.h1s.length === 0) errors.push("no <h1>");
  if (page.h1s.length > 1) errors.push(`${page.h1s.length} <h1> elements`);

  if (page.imgsNoAlt > 0) errors.push(`${page.imgsNoAlt}/${page.imgCount} <img> without alt`);

  return { errors, warnings, skipped: false };
}

/** Pull the indexable corpus from the sitemap index — the same set the site
    itself claims is worth indexing, so the audit can never drift from it. */
async function sitemapUrls() {
  /* Sitemap <loc> values are absolute CANONICAL urls (the public domain), so
     they must be rewritten onto the base being audited -- otherwise this tries
     to fetch the production host from a local run. */
  const localise = (loc) => new URL(new URL(loc).pathname, BASE);
  const index = await (await fetch(new URL("/sitemap.xml", BASE))).text();
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = new Set();
  for (const child of children) {
    const xml = await (await fetch(localise(child))).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(new URL(m[1]).pathname);
  }
  return [...urls];
}

const paths = await sitemapUrls();
if (paths.length === 0) {
  /* An empty sitemap is the CORRECT state when PUBLIC_INDEXING_ENABLED is off:
     nothing is being published, so there is nothing to audit. Failing here
     would make the SEO suite red for a deliberate configuration rather than a
     defect. Skip loudly instead. */
  console.log("onpage-audit: skipped — sitemap is empty (public indexing disabled)");
  process.exit(0);
}

let failed = 0;
let warned = 0;
let skipped = 0;
const duplicateTitles = new Map();

for (const path of paths) {
  const page = await auditPage(path);
  const { errors, warnings, skipped: isSkipped } = check(page);
  if (isSkipped) {
    skipped += 1;
  } else if (page.title) {
    duplicateTitles.set(page.title, [...(duplicateTitles.get(page.title) ?? []), path]);
  }
  for (const error of errors) {
    console.log(`  ✗ ${path} — ${error}`);
    failed += 1;
  }
  for (const warning of warnings) {
    console.log(`  ⚠ ${path} — ${warning}`);
    warned += 1;
  }
}

/* Duplicate titles are cannibalisation: two indexable pages competing for one
   query, each diluting the other. */
for (const [title, owners] of duplicateTitles) {
  if (owners.length > 1) {
    console.log(`  ✗ duplicate title across ${owners.length} pages (${owners.join(", ")}): ${JSON.stringify(title)}`);
    failed += owners.length;
  }
}

console.log(
  `onpage-audit: ${paths.length} sitemap URLs checked (${skipped} noindex skipped), ${failed} errors, ${warned} warnings`,
);
process.exit(failed > 0 ? 1 : 0);
