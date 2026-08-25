#!/usr/bin/env node
import fs from "node:fs";

const requiredFiles = [
  "vercel.json",
  "railway.json",
  "docker-compose.production-like.yml",
  ".env.staging.example",
  ".env.production.example",
  "governance/environments/phase-1-environments.json",
  "governance/secrets/phase-1-secret-inventory.json",
  "docs/operations/provisioning-execution-checklist.md"
];
const requiredEnvNames = [
  "NEXT_PUBLIC_SITE_URL",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "GSC_CREDENTIALS"
];
const failures = [];
for (const file of requiredFiles) if (!fs.existsSync(file)) failures.push(`missing ${file}`);
for (const file of [".env.staging.example", ".env.production.example"]) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const name of requiredEnvNames) if (!text.includes(`${name}=`)) failures.push(`${file} missing ${name}`);
}
const vercel = fs.existsSync("vercel.json") ? JSON.parse(fs.readFileSync("vercel.json", "utf8")) : null;
if (vercel && vercel.framework !== "nextjs") failures.push("vercel framework must be nextjs");
const railway = fs.existsSync("railway.json") ? JSON.parse(fs.readFileSync("railway.json", "utf8")) : null;
if (railway && !railway.deploy?.healthcheckPath?.includes("/api/observability/health")) failures.push("railway healthcheck must use observability health route");

console.log("Provisioning smoke audit");
console.log(`- Files checked: ${requiredFiles.length}`);
console.log(`- Env names checked: ${requiredEnvNames.length}`);

if (failures.length) {
  console.error("\nProvisioning smoke audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Provisioning smoke audit passed.");
