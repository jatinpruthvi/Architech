#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "seo/monitoring/search-console.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const failures = [];

if (config.propertyType !== "domain" && config.propertyType !== "url-prefix") failures.push("propertyType must be domain or url-prefix");
if (!String(config.propertyUrl ?? "").startsWith("sc-domain:") && !String(config.propertyUrl ?? "").startsWith("https://")) failures.push("propertyUrl must be sc-domain:* or https://*");
if (config.sitemapPath !== "/sitemap.xml") failures.push("sitemapPath must be /sitemap.xml for Phase 1 canonical sitemap");
if (!Array.isArray(config.sampleInspectionUrls) || config.sampleInspectionUrls.length < 4) failures.push("sampleInspectionUrls must include at least 4 route samples");
for (const url of config.sampleInspectionUrls ?? []) {
  if (!String(url).startsWith("/")) failures.push(`sample URL must be path-only: ${url}`);
}

console.log("Search Console setup audit");
console.log(`- Property: ${config.propertyUrl}`);
console.log(`- Sitemap: ${config.sitemapPath}`);
console.log(`- Sample URL inspections: ${config.sampleInspectionUrls.length}`);
console.log(`- Indexed ratio threshold: ${config.thresholds.minIndexedRatio}`);

if (failures.length) {
  console.error("\nSearch Console config failed:");
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("Search Console config passed.");
