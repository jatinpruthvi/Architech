#!/usr/bin/env node
import fs from "node:fs";

const inventory = JSON.parse(fs.readFileSync("governance/secrets/phase-1-secret-inventory.json", "utf8"));
const envExample = fs.readFileSync(".env.example", "utf8");
const failures = [];

if (inventory.policy !== "names_only_no_secret_values_in_source_control") failures.push("secret policy must forbid values in source control");
for (const secret of inventory.secrets ?? []) {
  for (const field of ["name", "scope", "owner", "environments", "rotationDays"]) {
    if (!secret[field] || (Array.isArray(secret[field]) && secret[field].length === 0)) failures.push(`${secret.name ?? "unknown"} missing ${field}`);
  }
  if (secret.scope === "server" && secret.name.startsWith("NEXT_PUBLIC_")) failures.push(`${secret.name} cannot be server-scoped and NEXT_PUBLIC`);
  if (!envExample.includes(`${secret.name}=`)) failures.push(`${secret.name} missing from .env.example`);
}

console.log("Secrets inventory audit");
console.log(`- Secrets tracked: ${inventory.secrets?.length ?? 0}`);
console.log(`- Storage policy: ${inventory.storage}`);

if (failures.length) {
  console.error("\nSecrets audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Secrets audit passed.");
