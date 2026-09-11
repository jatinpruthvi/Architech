#!/usr/bin/env node
/* PWA installability audit (static, no browser required).

   WHY THIS EXISTS

   The repo shipped a manifest in audit round 2 (docs/audits/IMPROVEMENT-REVIEW-2.md
   F9) whose two icon URLs 404'd — so the site advertised an installable app it
   could not deliver, and nothing caught it. Browsers fail installability
   silently: there is no console error a CI job can see, only a missing install
   affordance on a phone.

   This script asserts the parts of the install contract that are checkable
   over plain HTTP, so the next regression is a red build instead of a support
   thread:

     1. MANIFEST  — reachable, correctly typed, with the fields Chrome/Safari
        require (name, short_name, start_url, a standalone-class display mode).
     2. ICONS     — every declared icon actually resolves to an image, and at
        least one is 192px+ and one 512px+.
     3. WORKER    — /sw.js is reachable, is JavaScript, has a fetch handler
        (what iOS wants before it treats the site as a real web app), and is
        served without long caching (a cached worker never updates).
     4. OFFLINE   — the fallback page the worker serves is reachable HTML.
     5. HEAD TAGS — the home page links the manifest, carries a theme colour,
        an apple-touch-icon, and viewport-fit=cover (without the last one every
        env(safe-area-inset-*) in theme.css computes to 0px).

   It exits 1 on any failure so it can gate CI. */

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const MANIFEST_PATH = "/manifest.webmanifest";
const SW_PATH = "/sw.js";
const ALLOWED_DISPLAY = new Set(["standalone", "fullscreen", "minimal-ui"]);

const findings = [];
function record(check, ok, detail) {
  findings.push({ check, ok, detail });
}

async function head(url) {
  return fetch(url, { method: "GET", headers: { "user-agent": "pwa-audit" } });
}

function parseSizes(icon) {
  if (!icon.sizes || icon.sizes === "any") return null;
  const largest = String(icon.sizes)
    .split(/\s+/)
    .map(entry => Number.parseInt(entry.split("x")[0], 10))
    .filter(n => Number.isFinite(n));
  return largest.length ? Math.max(...largest) : null;
}

async function auditManifest() {
  const res = await head(BASE + MANIFEST_PATH);
  const type = res.headers.get("content-type") ?? "";
  record("manifest reachable", res.ok, `GET ${MANIFEST_PATH} → ${res.status}`);
  record(
    "manifest content type",
    /manifest\+json|json/i.test(type),
    `content-type: ${type || "(none)"}`
  );
  if (!res.ok) return null;

  let manifest;
  try {
    manifest = JSON.parse(await res.text());
  } catch (error) {
    record("manifest parses as JSON", false, String(error).slice(0, 120));
    return null;
  }

  for (const field of ["name", "short_name", "start_url", "display"]) {
    record(
      `manifest.${field}`,
      Boolean(manifest[field]),
      JSON.stringify(manifest[field] ?? null)
    );
  }
  record(
    "manifest.display installable",
    ALLOWED_DISPLAY.has(manifest.display),
    `display: ${manifest.display}`
  );
  if (typeof manifest.short_name === "string") {
    record(
      "manifest.short_name ≤ 12 chars",
      manifest.short_name.length <= 12,
      `"${manifest.short_name}" is ${manifest.short_name.length} chars`
    );
  }
  if (manifest.scope) {
    record(
      "manifest.start_url inside scope",
      String(manifest.start_url).startsWith(manifest.scope),
      `start_url ${manifest.start_url} / scope ${manifest.scope}`
    );
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  record(
    "manifest declares icons",
    icons.length > 0,
    `${icons.length} icon entries`
  );

  const widths = [];
  for (const icon of icons) {
    const url = new URL(icon.src, BASE + "/").toString();
    const iconRes = await head(url);
    const iconType = iconRes.headers.get("content-type") ?? "";
    record(
      `icon ${icon.src} reachable`,
      iconRes.ok && iconType.startsWith("image/"),
      `${iconRes.status} ${iconType || "(no type)"}`
    );
    const size = parseSizes(icon);
    if (size) widths.push(size);
  }
  record(
    "icon ≥ 192px",
    widths.some(w => w >= 192),
    widths.length ? `widths: ${widths.join(", ")}` : "no numeric sizes declared"
  );
  record(
    "icon ≥ 512px",
    widths.some(w => w >= 512),
    widths.length ? `widths: ${widths.join(", ")}` : "no numeric sizes declared"
  );

  /* Adaptive launchers (Android home screens) crop icons into circles and
     squircles; without a maskable entry the `any` icon gets its corners
     sliced. The icon loop above already proves the maskable src resolves. */
  const maskable = icons.filter(icon =>
    String(icon.purpose ?? "").includes("maskable")
  );
  record(
    "maskable icon declared",
    maskable.length >= 1,
    maskable.length ? `${maskable.length} maskable entry` : "none"
  );
  record(
    "maskable icon ≥ 512px",
    maskable.some(icon => (parseSizes(icon) ?? 0) >= 512),
    maskable.map(icon => icon.sizes).join(", ") || "none"
  );

  return manifest;
}

async function auditServiceWorker() {
  const res = await head(BASE + SW_PATH);
  const type = res.headers.get("content-type") ?? "";
  const cache = res.headers.get("cache-control") ?? "";
  record("service worker reachable", res.ok, `GET ${SW_PATH} → ${res.status}`);
  record(
    "service worker is JavaScript",
    /javascript/i.test(type),
    `content-type: ${type || "(none)"}`
  );
  record(
    "service worker not long-cached",
    /no-store|no-cache|max-age=0/.test(cache),
    `cache-control: ${cache || "(none)"}`
  );
  if (!res.ok) return;
  const body = await res.text();
  record(
    "service worker has a fetch handler",
    body.includes('addEventListener("fetch"') ||
      body.includes("addEventListener('fetch'"),
    "iOS treats a worker without fetch as inert"
  );
  record(
    "service worker precaches an offline page",
    /offline\.html/.test(body),
    "navigation fallback target"
  );
}

async function auditOfflinePage(manifest) {
  /* The worker names its own fallback; audit whatever it says it serves. */
  const res = await head(BASE + "/offline.html");
  const type = res.headers.get("content-type") ?? "";
  record(
    "offline fallback reachable",
    res.ok && type.includes("text/html"),
    `GET /offline.html → ${res.status} ${type}`
  );
  if (manifest) {
    const startUrl = new URL(manifest.start_url, BASE + "/").toString();
    const startRes = await head(startUrl);
    record(
      "start_url resolves",
      startRes.ok && startRes.redirected === false,
      `GET ${manifest.start_url} → ${startRes.status}${startRes.redirected ? " (redirected)" : ""}`
    );
  }
}

async function auditHeadTags() {
  const res = await head(BASE + "/");
  const html = await res.text();
  record("home page reachable", res.ok, `GET / → ${res.status}`);
  record(
    "<link rel=manifest>",
    /rel="manifest"/.test(html),
    "the browser only reads a manifest it is told about"
  );
  record(
    "theme-color meta",
    /name="theme-color"/.test(html),
    "status-bar colour in the installed app"
  );
  record(
    "apple-touch-icon",
    /rel="apple-touch-icon"/.test(html),
    "iOS ignores manifest icons for the home-screen tile"
  );
  record(
    "apple-mobile-web-app-capable",
    /name="(apple-)?mobile-web-app-capable"/.test(html),
    "iOS standalone launch"
  );
  record(
    "viewport-fit=cover",
    /name="viewport"[^>]*viewport-fit=cover/.test(html),
    "required for env(safe-area-inset-*) to be non-zero"
  );
}

console.log(`\nPWA installability audit — ${BASE}\n`);

try {
  const manifest = await auditManifest();
  await auditServiceWorker();
  await auditOfflinePage(manifest);
  await auditHeadTags();
} catch (error) {
  record("audit completed", false, String(error).slice(0, 160));
}

let failed = 0;
for (const finding of findings) {
  if (!finding.ok) failed += 1;
  console.log(
    `${finding.ok ? "PASS" : "FAIL"}  ${finding.check.padEnd(38)} ${finding.detail}`
  );
}

console.log(
  `\n${findings.length - failed}/${findings.length} checks passed${failed ? ` — ${failed} FAILED` : ""}\n`
);
process.exit(failed ? 1 : 0);
