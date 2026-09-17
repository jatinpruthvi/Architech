import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const OUTPUT = path.join(root, "docs", "MARKDOWN-DOCUMENTATION-INDEX.md");

// Directories that are never project documentation. `.git` and friends are
// already excluded by the dot-directory rule below; these are spelled out
// because they are not dot-prefixed.
const ignored = new Set(["node_modules", ".next", ".git"]);

/**
 * True when any path segment is a directory we should not index: a hidden
 * directory (`.agents/` holds the vendored skills library, not project docs)
 * or one of the build/dependency outputs above.
 */
function isIgnoredPath(relativePath) {
  const segments = relativePath.split("/");
  // The last segment is the file itself; only directories are tested.
  return segments.slice(0, -1).some((segment) => ignored.has(segment) || segment.startsWith("."));
}

/**
 * Ask git for the Markdown files that belong to the repository.
 *
 * WHY GIT AND NOT A DIRECTORY WALK
 *
 * CI regenerates this index and fails on any diff, so the file list has to be
 * the same on every machine. A walk of the working tree is not: it also picks
 * up whatever else happens to be on disk. That is not hypothetical —
 * `business_suite/*` are git submodules, recorded as gitlinks with no
 * `.gitmodules`, so a populated local checkout has thousands of Markdown files
 * where CI has fourteen empty directories. An index generated locally listed
 * them, and 497 links to files the repository does not contain were committed.
 * CI could only say the index was stale, not why.
 *
 * `--cached` lists tracked files, which is exactly the tree CI checks out, and
 * a submodule contributes its gitlink rather than its contents.
 * Returns null when git is unavailable (exported tarball, no repository), so
 * the caller can fall back to walking the disk.
 */
function listTrackedMarkdown() {
  const result = spawnSync("git", ["ls-files", "--cached", "--", "*.md"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // git quotes paths containing unusual characters; skip rather than guess.
    .filter((line) => !line.startsWith('"'));
}

/** Markdown files that exist on disk but are not tracked yet. */
function listUntrackedMarkdown() {
  const result = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "--", "*.md"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('"'))
    .filter((relativePath) => isIgnoredPath(relativePath) === false);
}

/** Fallback for a tree with no git: walk the disk the way this script used to. */
function walkMarkdownFiles() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name) || (entry.isDirectory() && entry.name.startsWith("."))) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    }
  }
  walk(root);
  return files;
}

const tracked = listTrackedMarkdown();
const usedGit = tracked !== null;
const files = (usedGit ? tracked.filter((file) => file.endsWith(".md") && !isIgnoredPath(file)) : walkMarkdownFiles()).sort((a, b) =>
  a.localeCompare(b),
);

function title(file) {
  return file.split("/").at(-1).replace(/\.md$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function category(file) {
  const first = file.split("/")[0];
  if (first === "README.md") return "Start Here";
  if (first === "AGENTS.md") return "Start Here";
  if (first !== "docs" && first !== "ops") return "Other";
  if (file.startsWith("docs/history/")) return "Historical Recommendations and Reviews";
  if (file.startsWith("docs/archive/")) return "Archive";
  if (file.startsWith("docs/planning/")) return "Planning";
  if (file.startsWith("docs/architecture/")) return "Architecture";
  if (file.startsWith("docs/seo/")) return "SEO and Authority";
  if (file.startsWith("docs/superpowers/")) return "Design Specs and Plans";
  if (file.startsWith("docs/audits/") || file.startsWith("docs/findings/")) return "Audits and Findings";
  if (file.startsWith("docs/research/")) return "Research";
  if (file.startsWith("docs/product/")) return "Product Inventories";
  if (file.startsWith("docs/specs/")) return "Specs";
  if (file.startsWith("ops/config/governance/")) return "Governance and Contracts";
  return "Product and Engineering Docs";
}

const groups = new Map();
for (const file of files) {
  const key = category(file);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(file);
}
const order = [
  "Start Here",
  "Architecture",
  "Planning",
  "Specs",
  "Product and Engineering Docs",
  "Product Inventories",
  "Governance and Contracts",
  "SEO and Authority",
  "Audits and Findings",
  "Research",
  "Design Specs and Plans",
  "Historical Recommendations and Reviews",
  "Archive",
  "Other",
];
const lines = [
  "# Architech Markdown Documentation Index",
  "",
  "> This index lists the project’s Markdown documentation as GitHub links. Start with the source-of-truth documents, then use the specialist sections for implementation and historical context. For a task-based map of the whole repository, read [AGENTS.md](../AGENTS.md).",
  "",
  // Deliberately a content digest, not a date: CI regenerates this file and
  // fails on any diff, so the output must be a pure function of the doc tree.
  // A timestamp would turn that check red on every day nobody happened to
  // regenerate, which is a false failure rather than a stale index.
  `Generated from the repository Markdown tree (${files.length} files, digest ${createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12)}).`,
  "",
  "## Recommended Reading Order",
  "",
  "1. [README.md](../README.md) — project source of truth and document map.",
  "2. [AGENTS.md](../AGENTS.md) — task-based navigation map for agents and humans.",
  "3. [docs/planning/STATUS.md](../docs/planning/STATUS.md) — current implementation and activation status.",
  "4. [docs/planning/PHASE-1-IMPLEMENTATION-PLAN.md](../docs/planning/PHASE-1-IMPLEMENTATION-PLAN.md) — active delivery tracker.",
  "5. [ops/config/governance/contracts/DOMAIN-CONTRACTS.md](../ops/config/governance/contracts/DOMAIN-CONTRACTS.md) — shared domain vocabulary and boundaries.",
  "6. [ops/config/governance/contracts/IMPLEMENTATION-MATRIX.md](../ops/config/governance/contracts/IMPLEMENTATION-MATRIX.md) — feature-to-code mapping.",
  "7. [docs/runtime-activation-gates.md](../docs/runtime-activation-gates.md) — production credentials and provider gates.",
  "",
];
for (const key of order) {
  const entries = groups.get(key);
  if (!entries?.length) continue;
  lines.push(`## ${key}`, "");
  for (const file of entries) lines.push(`- [${title(file)}](../${file})`);
  lines.push("");
}
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${lines.join("\n")}\n`);

// Tell the author when a doc they just wrote is missing, rather than letting
// them discover it as a red CI check. Only reachable on the git path: the walk
// already sees everything on disk.
if (usedGit) {
  const untracked = listUntrackedMarkdown();
  if (untracked.length > 0) {
    const shown = untracked.slice(0, 10);
    console.warn(
      `generate-md-index: indexed ${files.length} tracked Markdown files.\n` +
        `  ${untracked.length} Markdown file(s) are on disk but not tracked yet, so they are NOT in the index:\n` +
        shown.map((file) => `    - ${file}`).join("\n") +
        (untracked.length > shown.length ? `\n    … and ${untracked.length - shown.length} more` : "") +
        "\n  Run `git add <file>` and then `pnpm docs:index` again so the index and CI agree.",
    );
  }
} else {
  console.warn("generate-md-index: git unavailable, indexed the working tree as-is. Output may differ from CI.");
}
