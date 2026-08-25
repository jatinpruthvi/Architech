#!/usr/bin/env node
import fs from "node:fs";

const plan = JSON.parse(fs.readFileSync("governance/release/production-enablement-plan.json", "utf8"));
const failures = [];

if (plan.decision !== "do_not_enable_production_until_all_required_gates_are_evidenced") failures.push("production decision must remain blocked until evidence gates pass");
for (const env of ["preview", "staging", "production"]) {
  const found = plan.environments?.find((item) => item.name === env);
  if (!found) failures.push(`missing ${env} environment`);
  else {
    if (!found.platforms?.length) failures.push(`${env} missing platforms`);
    if (!found.requiredSecrets?.length) failures.push(`${env} missing required secrets`);
    if (!found.exitCriteria?.length) failures.push(`${env} missing exit criteria`);
  }
}
for (const adapter of ["repositories", "search", "leads", "auth", "media", "rera", "observability"]) {
  const found = plan.adapterSwitches?.find((item) => item.id === adapter);
  if (!found) failures.push(`missing adapter switch ${adapter}`);
  else if (!found.requiredEvidence?.length) failures.push(`${adapter} missing required evidence`);
}
for (const command of ["pnpm release:audit", "pnpm production:plan:audit", "pnpm security:audit", "pnpm ops:audit"]) {
  if (!plan.launchGates?.includes(command)) failures.push(`missing launch gate ${command}`);
}
if (!plan.blockedUntil?.some((item) => item.includes("legal gates"))) failures.push("blockedUntil must include legal gates");

console.log("Production enablement plan audit");
console.log(`- Environments: ${plan.environments?.length ?? 0}`);
console.log(`- Adapter switches: ${plan.adapterSwitches?.length ?? 0}`);
console.log(`- Launch gates: ${plan.launchGates?.length ?? 0}`);

if (failures.length) {
  console.error("\nProduction enablement audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Production enablement audit passed.");
