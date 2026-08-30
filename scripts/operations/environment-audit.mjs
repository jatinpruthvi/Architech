#!/usr/bin/env node
import fs from "node:fs";

const envs = JSON.parse(fs.readFileSync("governance/environments/phase-1-environments.json", "utf8"));
const failures = [];
const required = ["preview", "staging", "production"];

for (const name of required) {
  const env = envs.environments?.find((item) => item.name === name);
  if (!env) { failures.push(`missing environment ${name}`); continue; }
  for (const field of ["domainPattern", "deployment", "services", "requiredChecks", "requiredSecrets", "provisioningStatus"]) {
    if (!env[field] || (Array.isArray(env[field]) && env[field].length === 0)) failures.push(`${name} missing ${field}`);
  }
}

for (const name of ["staging", "production"]) {
  const env = envs.environments?.find((item) => item.name === name);
  if (env && !env.requiredSecrets.includes("ARCHITECH_CONTACT_ENCRYPTION_KEY")) failures.push(`${name} must require ARCHITECH_CONTACT_ENCRYPTION_KEY`);
  if (env && !env.services.includes("Requirement retention purge")) failures.push(`${name} must schedule the requirement retention purge`);
  if (env && !env.requiredChecks.includes("pnpm privacy:requirements:test")) failures.push(`${name} must test the requirement retention purge`);
}
const production = envs.environments?.find((item) => item.name === "production");
if (production && !production.requiredSecrets.includes("GSC_CREDENTIALS")) failures.push("production must require GSC_CREDENTIALS");

console.log("Environment provisioning audit");
console.log(`- Environments: ${envs.environments?.length ?? 0}`);
console.log(`- Status: ${envs.status}`);

if (failures.length) {
  console.error("\nEnvironment audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Environment audit passed.");
