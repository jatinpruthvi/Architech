#!/usr/bin/env node
import fs from "node:fs";

const evidencePath = "governance/release/phase-1-release-evidence.json";
const reportPath = "docs/release/phase-1-release-report.md";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const report = fs.readFileSync(reportPath, "utf8");
const failures = [];

for (const field of ["release", "date", "decision", "requiredCommands", "validatedAreas", "productionBlockers"]) {
  if (!evidence[field] || (Array.isArray(evidence[field]) && evidence[field].length === 0)) failures.push(`release evidence missing ${field}`);
}

for (const phrase of [
  "Prototype foundation validated",
  "Production enablement blockers",
  "Known limitations",
  "Release recommendation",
  "Do **not** market it as a live verified marketplace",
]) {
  if (!report.includes(phrase)) failures.push(`release report missing phrase: ${phrase}`);
}

if (evidence.decision !== "validated_prototype_foundation_not_production_enabled") {
  failures.push("release decision must explicitly block production enablement");
}

console.log("Phase 1 release audit");
console.log(`- Validated areas: ${evidence.validatedAreas.length}`);
console.log(`- Required commands: ${evidence.requiredCommands.length}`);
console.log(`- Production blockers: ${evidence.productionBlockers.length}`);

if (failures.length) {
  console.error("\nPhase 1 release audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Phase 1 release audit passed.");
