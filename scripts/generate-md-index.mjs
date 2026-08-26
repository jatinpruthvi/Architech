import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git"]);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
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
  if (first === "docs") return "Product and Engineering Docs";
  if (first === "governance") return "Governance and Contracts";
  if (first === "history") return "Historical Recommendations and Reviews";
  if (first === "seo") return "SEO and Authority";
  if (first === "planning") return "Planning";
  return "Root and Research Notes";
}

walk(root);
files.sort((a, b) => a.localeCompare(b));
const groups = new Map();
for (const file of files) {
  const key = category(file);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(file);
}
const order = ["Start Here", "Planning", "Product and Engineering Docs", "Governance and Contracts", "SEO and Authority", "Historical Recommendations and Reviews", "Root and Research Notes"];
const lines = [
  "# Architech Markdown Documentation Index",
  "",
  "> This index lists the project’s Markdown documentation as GitHub links. Start with the source-of-truth documents, then use the specialist sections for implementation and historical context.",
  "",
  `Generated on ${new Date().toISOString().slice(0, 10)} from the repository Markdown tree.`,
  "",
  "## Recommended Reading Order",
  "",
  "1. [README.md](./README.md) — project source of truth and document map.",
  "2. [STATUS.md](./STATUS.md) — current implementation and activation status.",
  "3. [PHASE-1-IMPLEMENTATION-PLAN.md](./PHASE-1-IMPLEMENTATION-PLAN.md) — active delivery tracker.",
  "4. [governance/contracts/DOMAIN-CONTRACTS.md](./governance/contracts/DOMAIN-CONTRACTS.md) — shared domain vocabulary and boundaries.",
  "5. [governance/contracts/IMPLEMENTATION-MATRIX.md](./governance/contracts/IMPLEMENTATION-MATRIX.md) — feature-to-code mapping.",
  "6. [docs/runtime-activation-gates.md](./docs/runtime-activation-gates.md) — production credentials and provider gates.",
  "",
];
for (const key of order) {
  const entries = groups.get(key);
  if (!entries?.length) continue;
  lines.push(`## ${key}`, "");
  for (const file of entries) lines.push(`- [${title(file)}](./${file})`);
  lines.push("");
}
fs.writeFileSync(path.join(root, "MARKDOWN-DOCUMENTATION-INDEX.md"), `${lines.join("\n")}\n`);
