#!/usr/bin/env node
import fs from "node:fs";

const requiredIds = ["LEG-001", "LEG-002", "LEG-003", "LEG-004", "LEG-005", "LEG-006", "LEG-007", "LEG-008", "LEG-009"];
const config = JSON.parse(fs.readFileSync("governance/legal/gates/phase-1-gates.json", "utf8"));
const failures = [];
const gates = new Map((config.gates ?? []).map((gate) => [gate.id, gate]));

for (const id of requiredIds) {
  const gate = gates.get(id);
  if (!gate) { failures.push(`${id} missing`); continue; }
  for (const field of ["owner", "status", "evidence", "reversal"]) {
    if (!gate[field] || (Array.isArray(gate[field]) && gate[field].length === 0)) failures.push(`${id} missing ${field}`);
  }
  for (const evidence of gate.evidence ?? []) {
    if (!fs.existsSync(evidence)) failures.push(`${id} evidence path missing: ${evidence}`);
  }
  if (process.env.LEGAL_GATES_ENFORCE_APPROVAL === "1" && gate.status !== "approved") failures.push(`${id} is not approved`);
}

console.log("Legal gate audit");
console.log(`- Gates checked: ${requiredIds.length}`);
console.log(`- Approval enforcement: ${process.env.LEGAL_GATES_ENFORCE_APPROVAL === "1" ? "on" : "off"}`);

if (failures.length) {
  console.error("\nLegal gate audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Legal gate audit passed.");
