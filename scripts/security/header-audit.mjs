#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("next.config.ts", "utf8");
const required = ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy", "X-DNS-Prefetch-Control"];
const failures = required.filter((header) => !source.includes(header));
if (!source.includes("frameAncestors") || !source.includes("'self' https://*.e2b.app")) failures.push("CSP frame-ancestors must preserve Arena preview compatibility");

console.log("Security header audit");
required.forEach((header) => console.log(`- ${header}`));

if (failures.length) {
  console.error("\nSecurity header audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Security header audit passed.");
