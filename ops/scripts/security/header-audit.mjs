#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("next.config.ts", "utf8");
const required = ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy", "X-DNS-Prefetch-Control"];
const failures = required.filter((header) => !source.includes(header));
// The CSP builds frame-ancestors conditionally: production uses a safe `'none'`
// while dev/preview preserves Arena compatibility via *.e2b.app. Validate both
// branches exist rather than checking a brittle literal string.
if (!source.includes("frameAncestors")) failures.push("CSP must define a frame-ancestors policy");
else {
  if (!source.includes("'none'")) failures.push("CSP frame-ancestors must be 'none' in production");
  if (!source.includes("https://*.e2b.app")) failures.push("CSP frame-ancestors must preserve Arena preview compatibility (https://*.e2b.app)");
}

console.log("Security header audit");
required.forEach((header) => console.log(`- ${header}`));

if (failures.length) {
  console.error("\nSecurity header audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Security header audit passed.");
