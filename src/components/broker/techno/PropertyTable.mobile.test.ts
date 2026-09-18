import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropertyTable, type PropertyRow } from "./PropertyTable";
import { readFileSync } from "node:fs";

const row: PropertyRow = {
  id: "property-1",
  externalId: "external-1",
  category: "ResidentialRent",
  propertyType: "Apartment",
  datePosted: new Date("2026-09-17T00:00:00.000Z"),
  address: "Shaligram Arcade, Thaltej, Ahmedabad",
  premiseName: "Shaligram Arcade",
  area: "Thaltej",
  rentPriceRaw: "₹ 35,000 / month",
  availabilityRaw: "Immediate",
  sqftRaw: "1,250 sqft",
  keyInfo: "3 BHK",
  isRentedOut: false,
  hasGallery: true,
  isPremium: true,
  ownerName: "Nilesh Shah",
  ownerPhoneLast4: "4306",
  ownerPhone: null,
  hasOwnerPhone: true,
  note: null,
  shortlisted: false,
  daysAgo: 0,
};

describe("PropertyTable responsive inventory", () => {
  it("renders an accessible card view alongside the full table", () => {
    const html = renderToStaticMarkup(
      createElement(PropertyTable, {
        rows: [row],
        total: 1,
        page: 1,
        perPage: 25,
        basePath: "/broker/owners/ResidentialRent",
      }),
    );

    expect(html).toContain('aria-label="Card view"');
    expect(html).toContain('aria-label="Table view"');
    expect(html).toContain('aria-label="Apartment property in Thaltej"');
    expect(html).toContain('aria-label="Property cards"');
    expect(html).toContain("₹ 35,000 / month");
  });

  it("keeps the active search and status filter in pagination links", () => {
    const html = renderToStaticMarkup(
      createElement(PropertyTable, {
        rows: [row],
        total: 100,
        page: 1,
        perPage: 25,
        basePath: "/broker/owners/ResidentialRent",
        currentSearch: "q=Thaltej&premium=1&page=1&perPage=25",
      }),
    );

    expect(html).toContain("q=Thaltej");
    expect(html).toContain("premium=1");
    expect(html).toContain("page=2");
  });

  it("offers recovery actions instead of a dead end when no property matches", () => {
    const html = renderToStaticMarkup(
      createElement(PropertyTable, {
        rows: [],
        total: 0,
        page: 1,
        perPage: 25,
        basePath: "/broker/owners/ResidentialRent",
      }),
    );

    expect(html).toContain('href="/broker/owners/ResidentialRent"');
    expect(html).toContain('href="/broker/search"');
    expect(html).toContain("Clear filters");
    expect(html).toContain("New search");
  });

  it("uses the shared focus-trapping dialog for the mobile note editor", () => {
    const source = readFileSync("src/components/broker/techno/NoteEditor.tsx", "utf8");
    expect(source).toContain('from "@/components/ui/dialog"');
    expect(source).toContain("<DialogContent");
    expect(source).not.toContain('role="dialog"');
  });
});
