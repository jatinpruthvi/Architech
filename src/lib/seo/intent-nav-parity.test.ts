/**
 * Intent navigation parity.
 *
 * Sitemap XML and llms.txt are generated from the SEO registry, so a new hub
 * appears in them automatically. The surfaces people actually navigate with —
 * header nav, command palette, HTML sitemap, footer — are HAND-MAINTAINED
 * lists of hardcoded hrefs. Nothing regenerates them.
 *
 * That gap is exactly how /rent/ shipped as a 12-city, 72-locality branch that
 * no menu on the site mentioned. The crawl simulation could not catch it: it
 * asks "is every sitemap URL reachable by SOME link?", and a single footer
 * link satisfies that while every other register still says the site only
 * sells homes.
 *
 * So these tests read the real source files and assert that a surface offering
 * one transaction intent offers the other too. Source-grepping is deliberate
 * (same tactic as entity-graph-integrity.test.ts): the alternative is
 * importing TSX components into a node test, which drags in React, next/link
 * and client hooks to verify a string constant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUICK_ACTIONS } from "../search/palette-actions";
import { strings } from "../i18n";
import { intentVocabulary, TRANSACTION_INTENTS } from "./intent";

const repoRoot = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

/** Every hand-maintained surface that links a transaction hub. */
const NAV_SURFACES = [
  { name: "header nav", file: "src/components/architech/Header.tsx" },
  { name: "footer", file: "src/components/architech/Footer.tsx" },
  { name: "HTML sitemap", file: "src/pages/PublicParity.tsx" },
] as const;

describe("intent navigation parity", () => {
  it.each(NAV_SURFACES)("$name links both /buy/ and /rent/", ({ file }) => {
    const source = read(file);
    for (const intent of TRANSACTION_INTENTS) {
      const href = `"/${intentVocabulary(intent).segment}/"`;
      expect(source.includes(href), `${file} is missing a ${href} link`).toBe(true);
    }
  });

  it("the command palette offers a quick action for both intents", () => {
    for (const intent of TRANSACTION_INTENTS) {
      const href = `/${intentVocabulary(intent).segment}/`;
      expect(
        QUICK_ACTIONS.some((action) => action.href === href),
        `no quick action points at ${href}`,
      ).toBe(true);
    }
  });

  /* buildPaletteGroups drops any action whose id has no reviewed label, so a
     missing translation silently removes the entry rather than showing a raw
     id. An untranslated action is therefore an invisible action. */
  it.each(Object.keys(strings))("locale %s labels every quick action", (locale) => {
    const labels = strings[locale as keyof typeof strings].palette.actions;
    for (const action of QUICK_ACTIONS) {
      const label = labels[action.id];
      expect(label, `${locale} has no palette label for ${action.id}`).toBeTruthy();
    }
  });

  it.each(Object.keys(strings))("locale %s names the rent hub in the footer", (locale) => {
    const links = strings[locale as keyof typeof strings].footer.links;
    expect(links.rent, `${locale} footer is missing the rent link label`).toBeTruthy();
    expect(links.rent).not.toBe(links.buy);
  });
});

describe("intent hub breadcrumbs", () => {
  /* A shared hubLabel read "Cities" on both trees, which told someone
     mid-trail nothing about which branch they were in. */
  it("gives each intent a distinct hub label", () => {
    const labels = TRANSACTION_INTENTS.map((intent) => intentVocabulary(intent).hubLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  /* Structured data that disagrees with the rendered trail is a mismatch
     Google can flag. Both city pages render Home / <hub> / <place>, so both
     BreadcrumbLists must declare three positions. */
  it.each([
    { intent: "buy" as const, file: "src/app/buy/[city]/page.tsx" },
    { intent: "rent" as const, file: "src/app/rent/[city]/page.tsx" },
  ])("$intent city JSON-LD breadcrumb mirrors the visible 3-step trail", ({ intent, file }) => {
    const source = read(file);
    const hub = `canonicalUrl("/${intentVocabulary(intent).segment}/")`;
    expect(source.includes(hub), `${file} breadcrumb skips the ${intent} hub`).toBe(true);
    expect(source).toMatch(/position:\s*3/);
  });
});
