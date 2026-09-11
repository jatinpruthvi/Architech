import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextApp = path.join(root, ".next", "server", "app");
const nextStatic = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "dist", "public");

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function copyFile(source, destination) {
  ensureDir(path.dirname(destination));
  const sourceStat = statSafe(source);
  if (!sourceStat) throw new Error(`Missing publish source: ${source}`);
  cpSync(source, destination, sourceStat.isDirectory() ? { recursive: true } : undefined);
}

function copyPublicAssets() {
  if (!statSafe(publicDir)) return;
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") continue;
    const source = path.join(publicDir, entry.name);
    const destination = path.join(outputDir, entry.name);
    if (entry.isDirectory()) cpSync(source, destination, { recursive: true });
    else copyFile(source, destination);
  }
}

function statSafe(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function walkHtmlFiles(dir, relative = "") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtmlFiles(absolute, entryRelative));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(entryRelative);
  }
  return files;
}

function materializePages() {
  if (!statSafe(nextApp)) throw new Error("Next.js server/app output is missing; run next build first.");

  for (const relativeFile of walkHtmlFiles(nextApp)) {
    if (relativeFile.startsWith("_global-error") || relativeFile.startsWith("_not-found")) continue;
    const routeFile = relativeFile.slice(0, -".html".length);
    const destination = routeFile === "index"
      ? path.join(outputDir, "index.html")
      : routeFile.endsWith(".html")
        ? path.join(outputDir, routeFile)
        : path.join(outputDir, routeFile, "index.html");
    copyFile(path.join(nextApp, relativeFile), destination);
  }

  const notFound = path.join(nextApp, "_not-found.html");
  if (statSafe(notFound)) copyFile(notFound, path.join(outputDir, "404.html"));

  const robotsBody = path.join(nextApp, "robots.txt.body");
  if (statSafe(robotsBody)) copyFile(robotsBody, path.join(outputDir, "robots.txt"));

  // The sitemap index plus one prerendered child sitemap per content type
  // (/sitemap/pages.xml, /sitemap/localities.xml, …). Copy every sitemap body
  // rather than naming them, so adding a segment is a registry edit only.
  for (const body of walkSitemapBodies(nextApp)) {
    const destination = path.join(outputDir, body);
    copyFile(path.join(nextApp, body), destination);
  }
}

/** Prerendered sitemap bodies: `sitemap.xml.body` and `sitemap/*.xml.body`. */
function walkSitemapBodies(dir, relative = "") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryRelative = path.join(relative, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "sitemap") found.push(...walkSitemapBodies(absolute, entryRelative));
      continue;
    }
    if (entry.isFile() && entryRelative.endsWith(".xml.body")) found.push(entryRelative.slice(0, -".body".length));
  }
  return found;
}

rmSync(path.join(root, "dist"), { recursive: true, force: true });
ensureDir(outputDir);
copyPublicAssets();
copyFile(nextStatic, path.join(outputDir, "_next", "static"));
copyFile(path.join(root, "scripts", "publish-server.mjs"), path.join(root, "dist", "index.js"));
materializePages();

const manifest = {
  generatedBy: "scripts/materialize-static-publish.mjs",
  source: "Next.js prerendered pages",
  runtimeNote: "Development publish artifact with a lightweight dist/index.js server entrypoint; the Next.js .next runtime remains preserved for future server deployment.",
};
writeFileSync(path.join(outputDir, "publish-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[publish-artifact] materialized ${outputDir}`);
