#!/usr/bin/env node
/* Contrast audit for solid fill + explicit label pairings.
 *
 * Motivation: the selected auth tab shipped at 2.01:1 (cream on the dark
 * theme's LIGHT saffron) and nobody noticed until a user could not read it.
 * The existing ratchets checked cascade-layer placement and a handful of
 * hand-picked token pairs; neither could catch "these two specific colours,
 * on this element, in this theme, do not contrast".
 *
 * This walks every className in the app, finds each pairing of a solid
 * background utility with an explicit text colour, resolves BOTH through the
 * real token values for BOTH themes, and computes the WCAG ratio — including
 * any CSS rule that deepens the fill in dark mode (`.clay-fill`, and the
 * `.bg-brick.text-cream` rule that fixed the auth tab).
 *
 * Thresholds follow WCAG 2.1 AA:
 *   4.5:1 normal text
 *   3.0:1 large text (>=18.66px bold or >=24px) and UI component boundaries
 * Small mono stamps are 11-12px, so they are held to 4.5:1.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = readFileSync(path.join(root, "client/src/theme.css"), "utf8");

/* ---------------- token resolution ---------------- */

function blockOf(marker) {
  const start = css.indexOf(marker);
  if (start < 0) return "";
  let depth = 0;
  let i = css.indexOf("{", start);
  const from = i;
  for (; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(from, i);
    }
  }
  return "";
}

const LIGHT = blockOf(":root {");
const DARK = blockOf(".dark {");

function rawToken(block, name) {
  const match = block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

/** Resolve a token to a hex value, following `var(--x)` indirection. */
function resolve(name, theme, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const block = theme === "dark" ? DARK : LIGHT;
  let value = rawToken(block, name) ?? rawToken(LIGHT, name);
  if (!value) return null;
  const varRef = value.match(/^var\(--([\w-]+)/);
  if (varRef) return resolve(varRef[1], theme, seen);
  value = value.replace(/\/\*.*?\*\//g, "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
}

/* ---------------- colour maths ---------------- */

function toRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ---------------- markup scan ---------------- */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "dist", "build"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = [...walk(path.join(root, "client/src")), ...walk(path.join(root, "app"))]
  .filter((f) => !f.includes(".stories.") && !f.includes(".test."));

/* Solid background utilities that fully cover their label. Gradient, opacity
   and translucent variants (`bg-brick/10`) are skipped: the effective colour
   depends on what is behind them, so a static ratio would be a guess. */
const FILLS = {
  "bg-brick": "brick",
  "bg-brick-deep": "brick-deep",
  "bg-ink": "ink",
  "bg-night": "night",
  "bg-paper": "paper",
  "bg-cream": "cream",
  "bg-sand": "sand",
  "bg-trust": "trust",
  "bg-ember": "ember",
  "bg-gold": "gold",
  "bg-card": "card",
};

const LABELS = {
  "text-cream": "cream",
  "text-ink": "ink",
  "text-paper": "paper",
  "text-brick": "brick",
  "text-brick-deep": "brick-deep",
  "text-night": "night",
  "text-trust": "trust",
  "text-ember": "ember",
  "text-gold": "gold",
};

/** Dark-theme rules that swap a fill for a deeper one. Mirrors theme.css. */
/** True when theme.css really contains the rule, rather than the audit assuming
 *  it. A hardcoded copy stays green after someone deletes the real declaration —
 *  exactly the regression this is supposed to catch. */
function hasRule(rule) {
  return css.includes(rule);
}

function effectiveFill(tokens, fillToken, theme, labelClass) {
  if (theme !== "dark") return fillToken;
  const hasFillClass = tokens.some((t) => /-fill$/.test(t));
  if (fillToken === "brick" && hasFillClass && hasRule(".dark .clay-fill { background: var(--brick-deep); }")) return "brick-deep";
  // .dark :where(.bg-brick.text-cream) { background-color: var(--brick-deep) }
  if (fillToken === "brick" && labelClass === "text-cream" && hasRule(".dark :where(.bg-brick.text-cream) { background-color: var(--brick-deep); }")) return "brick-deep";
  // .dark :where(.hover\:bg-brick:hover) { background-color: var(--brick-deep) }
  if (fillToken === "brick" && tokens.includes("hover:bg-brick") && hasRule(".dark :where(.hover\\:bg-brick:hover) { background-color: var(--brick-deep); }")) return "brick-deep";
  return fillToken;
}

const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const raw = match[1] ?? match[2] ?? "";

    /* A template className often holds several mutually exclusive branches:
         `${saved ? "bg-brick text-cream" : "bg-paper text-ink hover:bg-brick"}`
       Analysing the flat token list pairs `bg-brick` with `text-ink`, colours
       that never appear together — the false positives that made the first
       version of this audit untrustworthy. Each quoted branch, plus whatever
       sits outside the conditionals, is treated as its own element state. */
    const branches = [];
    const quoted = [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    const outside = raw.replace(/\$\{[^}]*\}/g, " ");
    if (quoted.length > 0) {
      for (const branch of quoted) branches.push(`${outside} ${branch}`);
    } else {
      branches.push(outside);
    }

    for (const branchSource of branches) {
    const tokens = branchSource.split(/\s+/).filter(Boolean);

    /* Evaluate each interaction STATE on its own. A className often carries two
       conditional branches ("saved" vs "unsaved") plus hover variants; naively
       pairing the first fill with the first label compares colours that never
       co-occur, which produced false positives while hiding the real defect —
       a hover fill that changes the background but not the label. */
    const bare = (t) => t.replace(/^!/, "");
    const stateOf = (t) => (t.includes(":") ? t.slice(0, t.lastIndexOf(":")) : "");
    const utilOf = (t) => bare(t.includes(":") ? t.slice(t.lastIndexOf(":") + 1) : t);

    const baseFill = tokens.find((t) => !t.includes(":") && Object.hasOwn(FILLS, bare(t)));
    const baseLabel = tokens.find((t) => !t.includes(":") && Object.hasOwn(LABELS, bare(t)));

    const states = new Set(tokens.filter((t) => t.includes(":")).map(stateOf));
    const pairs = [];
    if (baseFill && baseLabel) pairs.push({ state: "base", fill: bare(baseFill), label: bare(baseLabel) });
    for (const state of states) {
      const stateFill = tokens.find((t) => stateOf(t) === state && Object.hasOwn(FILLS, utilOf(t)));
      const stateLabel = tokens.find((t) => stateOf(t) === state && Object.hasOwn(LABELS, utilOf(t)));
      /* A state that changes only the fill inherits the base label — that is
         exactly the save-toggle bug, so it must be checked, not skipped. */
      if (!stateFill && !stateLabel) continue;
      const fill = stateFill ? utilOf(stateFill) : baseFill && bare(baseFill);
      const label = stateLabel ? utilOf(stateLabel) : baseLabel && bare(baseLabel);
      if (fill && label) pairs.push({ state, fill, label });
    }

    for (const pair of pairs) {
    const fillClass = pair.fill;
    const labelClass = pair.label;
    const fillToken = FILLS[fillClass];
    const labelToken = LABELS[labelClass];

    for (const theme of ["light", "dark"]) {
      const fillHex = resolve(effectiveFill(tokens, fillToken, theme, labelClass), theme);
      /* A `-fill` class sets `color` from an UNLAYERED rule, which beats every
         `text-*` utility regardless of state. So on those elements the label is
         whatever the fill dictates — reading the markup's `text-ink` would
         report a conflict that the cascade never actually produces. */
      const fillClassPresent = tokens.find((t) => /-fill$/.test(t));
      let effectiveLabelToken = labelToken;
      if (fillClassPresent === "clay-fill" || fillClassPresent === "night-fill") effectiveLabelToken = "cream";
      else if (fillClassPresent === "paper-fill") effectiveLabelToken = "ink";
      // :where(.hover\:bg-brick:hover) { color: var(--cream) }
      if (pair.state === "hover" && tokens.includes("hover:bg-brick") && hasRule(":where(.hover\\:bg-brick:hover) { color: var(--cream); }")) effectiveLabelToken = "cream";
      let labelHex = resolve(effectiveLabelToken, theme);
      if (theme === "dark" && fillToken === "trust" && effectiveLabelToken === "cream" && hasRule(".dark :where(.bg-trust.text-cream) { color: var(--night); }")) labelHex = resolve("night", theme);
      if (!fillHex || !labelHex) continue;
      const ratio = contrast(fillHex, labelHex);
      /* Icon-only surfaces are non-text content (WCAG 1.4.11, 3:1). Detected by
         the absence of any text-sizing utility plus a fixed square footprint —
         the shape every icon chip in this codebase uses. */
      const looksIconOnly =
        /\bh-\d+\b/.test(branchSource) && /\bw-\d+\b/.test(branchSource) &&
        !/\b(text-(xs|sm|base|lg|xl|\d?xl)|stamp|display|font-display)\b/.test(branchSource);
      const threshold = looksIconOnly ? 3 : 4.5;
      if (ratio >= threshold) continue;
      findings.push({
        file: path.relative(root, file),
        theme,
        pair: `${effectiveLabelToken === labelToken ? labelClass : `${labelClass}→${effectiveLabelToken}`} on ${fillClass}${pair.state === "base" ? "" : ` (${pair.state})`}`,
        hex: `${labelHex} on ${fillHex}`,
        ratio: Number(ratio.toFixed(2)),
        threshold,
        snippet: raw.slice(0, 70),
      });
    }
    }
    }
  }
}

const unique = new Map();
for (const f of findings) {
  const key = `${f.file}|${f.theme}|${f.pair}|${f.hex}`;
  if (!unique.has(key)) unique.set(key, f);
}
findings.length = 0;
findings.push(...unique.values());
findings.sort((a, b) => a.ratio - b.ratio);

if (findings.length === 0) {
  console.log("\x1b[32m✓ every solid fill + explicit label pairing clears its WCAG threshold in both themes\x1b[0m");
  process.exit(0);
}

console.log(`\x1b[31m${findings.length} pairing(s) under their WCAG threshold\x1b[0m\n`);
for (const f of findings) {
  const severity = "\x1b[31mFAIL";
  console.log(`${severity}\x1b[0m ${String(f.ratio).padStart(5)}:1 (needs ${f.threshold})  ${f.theme.padEnd(5)}  ${f.pair}`);
  console.log(`        ${f.hex}  ${f.file}`);
  console.log(`        ${f.snippet}`);
}
process.exit(1);
