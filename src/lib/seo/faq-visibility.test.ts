import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* Structural guard for the one rule FAQ markup must never break.
 *
 * Google requires FAQPage structured data to describe content VISIBLE on the
 * page. Marking up answers a user cannot see is a structured-data violation and
 * a manual-action risk — it is the single way this feature turns from a rich
 * result into a penalty.
 *
 * Unit tests on faq.ts cannot catch the real failure, because the failure is a
 * page that emits `buildFaqPage(...)` into its JSON-LD and then forgets to
 * render the entries. So this test reads the actual route files and asserts the
 * pairing. It is deliberately a source-level check: it is the only place that
 * can see "schema emitted but nothing rendered". */

const routes = execSync("grep -rl 'buildFaqPage' app --include='*.tsx'", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

/** Ways a page can legitimately put the answers on screen, in its own source. */
const RENDERS_ANSWERS = [
  /<FaqSection\b/, // the shared component, which renders question + answer
  /\.map\(\s*\(?\s*\w+\s*\)?\s*=>[\s\S]{0,400}?\.answer/, // an inline list
];

/* A route may also render the answers indirectly: it emits schema from a
   shared content module and delegates the UI to a component that imports the
   SAME module. That is still one source of truth, so it satisfies the rule —
   but only if we can actually prove the component consumes that module. */
function rendersViaSharedModule(src: string, array: string | undefined): boolean {
  if (!array) return false;
  const modulePath = src.match(new RegExp(`import\\s*\\{[^}]*\\b${array}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`))?.[1];
  if (!modulePath) return false;
  // Find every other file importing the same constant from the same module.
  const consumers = execSync(
    `grep -rl "${array}" client/src app --include='*.tsx' || true`,
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  return consumers.some((file) => {
    const consumer = readFileSync(file, "utf8");
    if (!consumer.includes(modulePath)) return false;
    // The consumer must actually render the answer text, not just re-export it.
    return /\.answer\b/.test(consumer) || /\.map\(/.test(consumer);
  });
}

describe("FAQ schema never describes invisible content", () => {
  it("finds the routes that emit FAQ schema", () => {
    // If this drops to zero the rest of the file silently passes forever.
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes)("%s renders the answers it marks up", (route) => {
    const src = readFileSync(route, "utf8");
    const array = src.match(/buildFaqPage\(\s*([A-Za-z_$][\w$]*)/)?.[1];
    const renders =
      RENDERS_ANSWERS.some((pattern) => pattern.test(src)) || rendersViaSharedModule(src, array);
    expect(
      renders,
      `${route} calls buildFaqPage but does not appear to render the answers. ` +
        "FAQ structured data must describe content visible on the page; render " +
        "the same array via <FaqSection entries={...} /> or remove the schema.",
    ).toBe(true);
  });

  it.each(routes)("%s builds schema and UI from one array", (route) => {
    const src = readFileSync(route, "utf8");
    /* Both sides must reference the same identifier. Two separately-built
       arrays are how the copy and the markup drift apart over time. */
    const built = src.match(/buildFaqPage\(\s*([A-Za-z_$][\w$]*)/)?.[1];
    expect(built, `${route}: buildFaqPage should receive a named array, not an inline literal`).toBeTruthy();
    const rendered =
      src.match(/<FaqSection[\s\S]{0,200}?entries=\{\s*([A-Za-z_$][\w$]*)\s*\}/)?.[1] ??
      src.match(/\{\s*([A-Za-z_$][\w$]*)\.map\(/)?.[1];
    if (rendered === undefined) {
      // Indirect case: the UI lives in a component sharing the same module.
      expect(
        rendersViaSharedModule(src, built),
        `${route}: schema is built from "${built}" but no component imports that same module to render it`,
      ).toBe(true);
      return;
    }
    expect(rendered, `${route}: schema is built from "${built}" but the UI renders "${rendered}"`).toBe(built);
  });
});
