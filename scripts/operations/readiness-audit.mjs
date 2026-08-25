#!/usr/bin/env node
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("governance/operations/phase-1-operational-readiness.json", "utf8"));
const failures = [];

function positiveNumber(field) {
  if (!Number.isFinite(config[field]) || config[field] <= 0) failures.push(`${field} must be a positive number`);
}

for (const field of ["rpoHours", "rtoHours", "backupRetentionDays", "restoreDrillCadenceDays", "costReviewCadenceDays"]) positiveNumber(field);

if (!Array.isArray(config.services) || config.services.length < 5) failures.push("at least five services must be registered");
for (const service of config.services ?? []) {
  for (const field of ["id", "name", "platform", "criticality", "backup", "restore", "owner"]) {
    if (!service[field]) failures.push(`${service.id ?? "unknown-service"} missing ${field}`);
  }
  if (!Number.isFinite(service.monthlyBudgetInr) || service.monthlyBudgetInr <= 0) failures.push(`${service.id} monthlyBudgetInr must be positive`);
  if (!Number.isFinite(service.alertAtPercent) || service.alertAtPercent <= 0 || service.alertAtPercent > 100) failures.push(`${service.id} alertAtPercent must be between 1 and 100`);
}

if (!Array.isArray(config.restoreDrillChecklist) || config.restoreDrillChecklist.length < 6) failures.push("restoreDrillChecklist must include at least six steps");
if (!Array.isArray(config.costCategories) || config.costCategories.length < 6) failures.push("costCategories must include at least six categories");

const totalBudget = (config.services ?? []).reduce((sum, service) => sum + (service.monthlyBudgetInr || 0), 0);
console.log("Operational readiness audit");
console.log(`- Services: ${(config.services ?? []).length}`);
console.log(`- RPO/RTO: ${config.rpoHours}h / ${config.rtoHours}h`);
console.log(`- Backup retention: ${config.backupRetentionDays} days`);
console.log(`- Monthly budget envelope: ₹${totalBudget.toLocaleString("en-IN")}`);

if (failures.length) {
  console.error("\nOperational readiness audit failed:");
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log("Operational readiness audit passed.");
