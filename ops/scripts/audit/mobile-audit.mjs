#!/usr/bin/env node
/* Mobile-compatibility audit (static, no browser required).

   WHY THIS EXISTS

   A responsive audit normally needs a real browser at 360px so overflow and tap
   targets can be measured. This sandbox has no browser binary and Playwright's
   download is blocked, so instead of shipping an unaudited guess this script
   reads the server-rendered HTML of the live dev server and applies the CSS
   rules that actually decide mobile behaviour:

     1. HORIZONTAL OVERFLOW RISK — an element whose min-width is wider than the
        360px viewport is only safe if some ancestor can scroll sideways
        (`overflow-x-auto`). Tables in this repo follow that pattern; anything
        that sets `min-w-[720px]` without it is a real horizontal-scroll bug.

     2. TAP TARGETS — WCAG 2.5.8 / Apple HIG want ~44 CSS px. This repo has a
        `.touch-44` utility for exactly that, so an interactive element with a
        small padding box and no `.touch-44` is the gap, not a style opinion.

     3. FIXED GRID COLUMNS — `grid-cols-N` with no responsive prefix renders N
        columns at 360px, which is how dashboards become unreadable on a phone.

     4. CALL AFFORDANCE — counts `tel:` links per route, because the broker
        lead inbox is the surface under review for one-tap calling.

   It reports, it does not fail: thresholds are advisory until the mobile
   baseline is agreed. */

/* The base URL comes from argv, not process.env: every env key read anywhere in
   the tree must be in the allow-list (client/src/lib/operations/env-catalog-parity.test.ts),
   and a one-off developer script has no business adding a governance surface to
   get its own argument. */
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const VIEWPORT_MIN_PX = 360;

const ROUTES = [
  "/",
  "/search/",
  "/buy/",
  "/buy/ahmedabad/",
  "/buy/ahmedabad/thaltej/",
  "/saved/",
  "/dashboard/",
  "/broker/leads/",
  "/broker/leads/lead_prototype_hot/",
  "/broker/dashboard/",
  "/broker/agent/",
  "/broker/channel/",
  "/broker/onboarding/",
  "/broker/listings/new/",
];

/** Strip tags into a flat list of elements with their attributes, in document
    order. A real parser would be better; the markup here is machine-generated
    and well-nested, and we only need attributes plus ancestor context. */
function parseElements(html) {
  const body = html.slice(html.indexOf("<body"));
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    const [, closing, tag, attrsRaw, selfClose] = match;
    if (["script", "style", "svg", "noscript"].includes(tag) && !closing) {
      // Skip to the matching close so inner markup is not mistaken for elements.
      const end = body.indexOf(`</${tag}`, re.lastIndex);
      if (end > -1) re.lastIndex = end + tag.length + 3;
      continue;
    }
    if (closing) {
      stack.pop();
      continue;
    }
    const attrs = {};
    const attrRe = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = attrRe.exec(attrsRaw)) !== null) attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? "";
    const node = { tag, attrs, ancestors: [...stack] };
    out.push(node);
    if (!selfClose && !["img", "input", "br", "hr", "meta", "link"].includes(tag)) stack.push(node);
  }
  return out;
}

const INTERACTIVE = new Set(["a", "button", "input", "select", "textarea"]);

function minWFromClass(className) {
  // Tailwind arbitrary values: min-w-[760px]
  const m = /min-w-\[(\d+)px\]/.exec(className);
  return m ? Number(m[1]) : null;
}

function hasScrollableAncestor(node) {
  return node.ancestors.some((a) => /overflow-x-auto|overflow-auto|overflow-x-scroll/.test(a.attrs.class ?? ""));
}

function tapTargetRisk(node) {
  const cls = node.attrs.class ?? "";
  if (/touch-44/.test(cls)) return false;
  // Icon-only controls are the highest risk: no text to grow the box.
  const textless =
    node.tag !== "input" &&
    node.tag !== "select" &&
    node.tag !== "textarea" &&
    !/\bh-\d+\b/.test(cls) &&
    (/grid h-\d+ w-\d+ place-items-center/.test(cls) || /h-(9|10|11) w-(9|10|11)/.test(cls));
  if (textless) return true;
  // Tight padding on a text control: py-1/py-1.5 with small type.
  return /\bpy-(1|1\.5)\b/.test(cls) && /!text-\[(9|10|11)px\]/.test(cls);
}

function fixedGridColumns(node) {
  const cls = node.attrs.class ?? "";
  const bare = /(?:^|\s)grid-cols-(\d+)/.exec(cls);
  if (!bare) return null;
  const n = Number(bare[1]);
  if (n <= 2) return null;
  // Safe if a mobile-first responsive variant exists (e.g. grid-cols-1 md:grid-cols-4)
  // or every grid-cols-* occurrence is prefixed.
  const occurrences = cls.match(/(?:^|\s)(?:(?:sm|md|lg|xl|2xl):)?grid-cols-\d+/g) ?? [];
  const anyMobileFirst = occurrences.some((o) => /(?:^|\s)grid-cols-(1|2)$/.test(o));
  const allPrefixed = occurrences.every((o) => /(?:sm|md|lg|xl|2xl):/.test(o.trim()));
  if (allPrefixed || anyMobileFirst) return null;
  return n;
}

async function auditRoute(path) {
  const res = await fetch(BASE + path, { headers: { "user-agent": "mobile-audit" } });
  const html = await res.text();
  const elements = parseElements(html);

  const overflow = [];
  const taps = [];
  const grids = [];
  let telLinks = 0;
  let waLinks = 0;

  for (const node of elements) {
    const cls = node.attrs.class ?? "";
    const href = node.attrs.href ?? "";
    if (href.startsWith("tel:")) telLinks++;
    if (href.includes("wa.me")) waLinks++;

    const mw = minWFromClass(cls);
    if (mw && mw > VIEWPORT_MIN_PX && !hasScrollableAncestor(node) && !/overflow-x-auto/.test(cls)) {
      overflow.push({ tag: node.tag, minW: mw, cls: cls.slice(0, 90) });
    }
    if (INTERACTIVE.has(node.tag) && tapTargetRisk(node)) {
      taps.push({ tag: node.tag, cls: cls.slice(0, 90), label: (node.attrs["aria-label"] ?? "").slice(0, 40) });
    }
    const g = fixedGridColumns(node);
    if (g) grids.push({ tag: node.tag, cols: g, cls: cls.slice(0, 80) });
  }

  return {
    path,
    status: res.status,
    elements: elements.length,
    telLinks,
    waLinks,
    overflow: overflow.slice(0, 8),
    overflowCount: overflow.length,
    tapRisks: taps.slice(0, 8),
    tapRiskCount: taps.length,
    grids: grids.slice(0, 6),
    gridCount: grids.length,
  };
}

const results = [];
for (const route of ROUTES) {
  try {
    results.push(await auditRoute(route));
  } catch (error) {
    results.push({ path: route, status: "ERROR", error: String(error).slice(0, 120) });
  }
}

console.log(`\nMobile audit @ ${VIEWPORT_MIN_PX}px baseline — ${BASE}\n`);
console.log("route                        status  els   tel:  wa.me  overflow  tapRisk  fixedGrid");
for (const r of results) {
  if (r.status === "ERROR") {
    console.log(`${r.path.padEnd(28)} ERROR   ${r.error}`);
    continue;
  }
  console.log(
    `${r.path.padEnd(28)} ${String(r.status).padEnd(7)} ${String(r.elements).padEnd(5)} ${String(r.telLinks).padEnd(5)} ${String(r.waLinks).padEnd(6)} ${String(r.overflowCount).padEnd(9)} ${String(r.tapRiskCount).padEnd(8)} ${r.gridCount}`
  );
}

console.log("\n--- details (first offenders per route) ---");
for (const r of results) {
  if (r.status === "ERROR") continue;
  const hasFindings = r.overflowCount || r.tapRiskCount || r.gridCount;
  if (!hasFindings) continue;
  console.log(`\n## ${r.path}`);
  for (const o of r.overflow) console.log(`   OVERFLOW  <${o.tag}> min-w-[${o.minW}px]  ${o.cls}`);
  for (const t of r.tapRisks.slice(0, 5)) console.log(`   TAP       <${t.tag}> ${t.label || t.cls}`);
  for (const g of r.grids.slice(0, 4)) console.log(`   GRID      <${g.tag}> grid-cols-${g.cols} (no mobile-first variant)  ${g.cls}`);
}
