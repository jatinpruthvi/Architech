import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git"]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || (entry.isDirectory() && entry.name.startsWith("."))) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
  }
}

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

walk(root);
files.sort((a, b) => a.localeCompare(b));
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
  `Generated on ${new Date().toISOString().slice(0, 10)} from the repository Markdown tree.`,
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
fs.writeFileSync(path.join(root, "docs", "MARKDOWN-DOCUMENTATION-INDEX.md"), `${lines.join("\n")}\n`);
