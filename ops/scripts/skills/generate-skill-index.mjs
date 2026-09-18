import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const SKILLS_DIR = path.join(root, ".agents", "skills");
const OUTPUT = path.join(SKILLS_DIR, "INDEX.md");
const CHECK = process.argv.includes("--check");

/**
 * Skills that should be considered FIRST for this repository, with the repo
 * evidence that justifies each. Curated by hand (the `agent-sort` skill's
 * DAILY bucket) — the stack evidence lives in the root AGENTS.md:
 * Next.js 16 App Router, React 19, TS strict, Prisma 7 + PostGIS, Tailwind 4,
 * pnpm, vitest, Playwright a11y/UI/e2e suites, Storybook, SEO monitoring.
 *
 * Order matters: workflow skills come first (they gate HOW work is done),
 * stack skills after (they gate WHAT the code looks like).
 */
const DAILY_SHORTLIST = [
  { id: "brainstorming", why: "Hard gate in the skill itself: explore intent/design before any feature or component work" },
  { id: "search-first", why: "Research existing tools/patterns before writing custom code" },
  { id: "writing-plans", why: "Multi-step task with a spec — plan before touching code" },
  { id: "executing-plans", why: "Working from a written plan with review checkpoints" },
  { id: "test-driven-development", why: "Unit tests are colocated vitest (`src/**/*.test.ts`); skill gates implementation behind tests" },
  { id: "systematic-debugging", why: "Any bug, test failure, or unexpected behavior — before proposing fixes" },
  { id: "verification-before-completion", why: "Maps to `pnpm verify`/`pnpm quality` — run gates before claiming done" },
  { id: "requesting-code-review", why: "After major features, before merging" },
  { id: "receiving-code-review", why: "Before acting on review feedback" },
  { id: "nextjs-turbopack", why: "Next.js 16 repo (`next.config.ts`, `proxy.ts` middleware)" },
  { id: "react-patterns", why: "React 19 App Router — server/client boundaries, Suspense, forms" },
  { id: "react-performance", why: "Perf budgets enforced (`ops/config/performance/budgets.json`)" },
  { id: "react-testing", why: "Vitest component tests + Playwright decision boundary" },
  { id: "frontend-patterns", why: "All UI lives in `src/components`, `src/app`" },
  { id: "accessibility", why: "Three Playwright a11y suites run in CI (`playwright.a11y*.config.ts`)" },
  { id: "frontend-a11y", why: "Companion implementation guide for the a11y suites" },
  { id: "prisma-patterns", why: "Prisma 7 (`db/schema.prisma`, `prisma.config.ts`)" },
  { id: "postgres-patterns", why: "PostGIS schema, RLS audits in `ops/scripts/security/`" },
  { id: "database-migrations", why: "`prisma migrate` workflow, `db/migrations`" },
  { id: "api-design", why: "REST endpoints under `src/app/api/`" },
  { id: "security-review", why: "Header/RLS/legal-gate audits are CI gates (`pnpm security:audit`)" },
  { id: "error-handling", why: "Typed errors + error boundaries in TS app code" },
  { id: "playwright-automation", why: "e2e/a11y/UI suites in `tests/`" },
  { id: "seo", why: "SEO is a product pillar: `pnpm test:seo`, `ops/config/seo/`, crawl simulation" },
  { id: "design-system", why: "shadcn primitives (`src/components/ui/`) + theme tokens (`src/theme.css`)" },
  { id: "architecture-decision-records", why: "Decisions recorded in `docs/architecture/`, `ops/config/governance/decisions/`" },
  { id: "codebase-onboarding", why: "First session in this repo — pairs with root AGENTS.md map" },
  { id: "documentation-lookup", why: "Prefer live framework docs over training data for Next/React/Prisma versions" },
];

const DESC_LIMIT = 160;

/** Collapse YAML folding and trim to a one-line summary at a word boundary. */
function toOneLine(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  const limit = flat.length <= DESC_LIMIT ? flat.length : flat.lastIndexOf(" ", DESC_LIMIT);
  const oneLine = flat.slice(0, limit > DESC_LIMIT * 0.6 || limit === flat.length ? limit : DESC_LIMIT);
  // Escape pipes so a description can never break the markdown table.
  return `${oneLine.replace(/[,;:.\s]+$/, "").replace(/\|/g, "\\|")}${flat.length > DESC_LIMIT ? "…" : ""}`;
}

/**
 * Minimal frontmatter reader for the two fields this index needs.
 * Handles plain, double/single-quoted, folded (`>`/`>-`/`>+`) and literal
 * (`|`/`|-`/`|+`) scalars — the vendored libraries use all of them.
 */
function readFrontmatter(md) {
  const normalized = md.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return {};
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = normalized.slice(4, end).split("\n");

  const fields = {};
  for (let i = 0; i < block.length; i++) {
    const match = /^(name|description):(.*)$/.exec(block[i]);
    if (!match) continue;
    const [, key, inline] = match;
    const inlineValue = inline.trim();
    if (inlineValue && !/^[>|]/.test(inlineValue)) {
      fields[key] = inlineValue.replace(/^["']|["']$/g, "").trim();
      continue;
    }
    // Block scalar: consume the more-indented lines that follow.
    const parts = [];
    while (i + 1 < block.length && (/^\s/.test(block[i + 1]) || block[i + 1] === "")) {
      i += 1;
      parts.push(block[i].trim());
    }
    fields[key] = parts.join(" ").trim();
  }
  return fields;
}

/**
 * List skill definition files the way `generate-md-index.mjs` does — from the
 * git index, not a directory walk, so the output is identical on CI (where
 * `business_suite/*` submodules are empty) and on a populated checkout.
 * Falls back to a walk when git is unavailable (exported tarball).
 */
function listSkillFiles() {
  const result = spawnSync("git", ["ls-files", "--cached", "--", ".agents/skills"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.error && result.status === 0) {
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /\/SKILL(\.src)?\.md$/.test(line));
  }
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\/SKILL(\.src)?\.md$/.test(`${path.sep}${entry.name}`)) files.push(full);
    }
  })(SKILLS_DIR);
  return files.map((file) => path.relative(root, file).split(path.sep).join("/"));
}

/**
 * Extract a name/description from a skill definition that has no YAML
 * frontmatter (repo-local skill docs like `playwright-automation` start
 * directly with a heading and a paragraph).
 */
function readBodyFallback(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let name;
  let i = 0;
  if (/^#\s+/.test(lines[0])) {
    name = lines[0].replace(/^#\s+/, "").trim();
    i = 1;
  }
  while (i < lines.length && (lines[i].trim() === "" || /^#/.test(lines[i]))) i += 1;
  const paragraph = [];
  while (i < lines.length && lines[i].trim() !== "") {
    paragraph.push(lines[i]);
    i += 1;
  }
  return { name, description: paragraph.join(" ").replace(/\s+/g, " ").trim() };
}

function loadSkills() {
  const skills = [];
  for (const file of listSkillFiles()) {
    const id = file.replace(/^\.agents\/skills\//, "").replace(/\/SKILL(\.src)?\.md$/, "");
    let md = "";
    try {
      md = fs.readFileSync(path.join(root, file), "utf8");
    } catch {
      continue; // tracked but not checked out (sparse checkout) — skip
    }
    const frontmatter = readFrontmatter(md);
    const fallback = Object.keys(frontmatter).length === 0 ? readBodyFallback(md) : {};
    skills.push({
      id,
      library: id.includes("/") ? id.split("/")[0] : null,
      name: frontmatter.name || fallback.name || id.split("/").pop(),
      description: toOneLine(frontmatter.description || fallback.description || ""),
      path: file,
    });
  }
  skills.sort((a, b) => a.id.localeCompare(b.id));
  return skills;
}

function renderTable(rows) {
  const lines = ["| Skill | What it does |", "|---|---|"];
  for (const row of rows) {
    lines.push(`| \`${row.id}\` | ${row.description || "_(no description in frontmatter)"} |`);
  }
  return lines.join("\n");
}

function render() {
  const skills = loadSkills();
  const topLevel = skills.filter((s) => !s.library);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const shortlist = DAILY_SHORTLIST.map((entry) => ({ ...byId.get(entry.id), why: entry.why })).filter(
    (s) => s.id,
  );
  const missing = DAILY_SHORTLIST.filter((entry) => !byId.has(entry.id)).map((entry) => entry.id);

  const libraries = [...new Set(skills.filter((s) => s.library).map((s) => s.library))].sort();
  const today = new Date().toISOString().slice(0, 10);

  const out = [];
  out.push(`<!-- Generated by \`ops/scripts/skills/generate-skill-index.mjs\` — do not edit by hand. -->
<!-- Regenerate with \`pnpm skills:index\`. Kept deterministic (sorted, no timestamp drift). -->

# Skills index — read this before choosing how to do the task

${skills.length} agent skills are vendored under \`.agents/skills/\` (${topLevel.length} top-level, ${
    skills.length - topLevel.length
  } in vendored libraries, last regenerated ${today}).
Each skill is a folder with a \`SKILL.md\` that turns a general agent into a
specialist for one kind of work.

## Routing rule (apply to every non-trivial task)

1. **Scan the Daily shortlist below.** These are pre-matched to this repo's stack.
2. **No fit?** Search the full tables: \`grep -i "<keyword>" .agents/skills/INDEX.md\`.
3. **Pick the single best-matching skill, then read its \`SKILL.md\` in full before acting.**
4. **Say which skill you picked and why** ("Using skill: \`x\` — because …"). If none
   matches, say "no skill matched" and proceed. Never skip this silently.

One best skill per task; when two apply, use the more specific one and mention the
other. A skill advises *how*; the root \`AGENTS.md\` still decides *where* files go.

## Daily shortlist — this repo's stack

Workflow skills first (how the work is gated), stack skills after (what the code looks like):

| Skill | Why it is daily here |
|---|---|
${shortlist.map((s) => `| \`${s.id}\` — ${s.description} | ${s.why} |`).join("\n")}
`);

  out.push(`## All top-level skills (A–Z)

${renderTable(topLevel)}
`);

  for (const library of libraries) {
    const rows = skills.filter((s) => s.library === library);
    out.push(`## Library: \`${library}\` (${rows.length} skills)

${renderTable(rows)}
`);
  }

  out.push(`## Maintenance

- Add or change a skill → run \`pnpm skills:index\` and commit the regenerated file.
- \`pnpm skills:index:check\` exits 1 when this file is stale (safe to wire into CI).
- Vendored libraries are re-synced by hand — see \`README.md\` in this directory.
${missing.length > 0 ? `- WARNING: shortlist entries not found on disk: ${missing.join(", ")}\n` : ""}`);

  return out.join("\n");
}

const generated = render();

if (CHECK) {
  const onDisk = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (onDisk === generated) {
    console.log("skills index is up to date");
  } else {
    console.error("skills index is stale — run `pnpm skills:index` and commit the result");
    process.exit(1);
  }
} else {
  fs.writeFileSync(OUTPUT, generated);
  const count = (generated.match(/\| `/g) || []).length;
  console.log(`wrote ${path.relative(root, OUTPUT)} (${count} skill rows)`);
}
