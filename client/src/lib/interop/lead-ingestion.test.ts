import { describe, expect, it } from "vitest";
import {
  CONSENT_CLASSES,
  LEAD_INGESTION_CONTRACT_VERSION,
  LEAD_SOURCES,
  consentPermissionsFor,
  ingestIdempotencyKey,
  validateIngestedLead,
  type IngestedLeadInput,
} from "./lead-ingestion";

/* A property-portal push payload (the verified field names of the first
   Phase-4 portal), mapped by the adapter into the contract. Which portal
   each id maps to is a docs fact, not a code fact: see
   docs/business-suite/lead-ingestion-contract.md §1. */
function portalLead(overrides: Partial<IngestedLeadInput> = {}): IngestedLeadInput {
  return {
    source: "property-portal-1",
    subsource: "Goregaon premium pack",
    providerLeadId: "MB-59679995-8821",
    occurredAt: "2026-09-08T10:14:00Z",
    name: { full: "Rahil Shah" },
    mobile: "+91 8097974258",
    email: "RAHIL@Example.com",
    city: "Mumbai",
    locality: "Goregaon West",
    budgetMinInr: 10_000_000,
    budgetMaxInr: 11_000_000,
    remarks: "Looking for 3 BHK Multistorey Apartment for Sale in Goregaon West, Mumbai.",
    consent: {
      consentClass: "portal-shared",
      capturedAt: "2026-09-08T10:14:00Z",
      evidence: "property-portal-1:push:MB-59679995-8821",
    },
    ...overrides,
  };
}

describe("lead ingestion contract", () => {
  it("normalizes a portal lead end to end", () => {
    const result = validateIngestedLead(portalLead());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lead.dedupeKey).toBe("+918097974258");
    expect(result.lead.email).toBe("rahil@example.com");
    expect(result.lead.source.channelClass).toBe("third-party-shared");
    expect(result.lead.consent.permissions).toEqual({
      humanFirstTouch: true,
      automatedWhatsAppFirstTouch: false,
      automatedEmail: false,
      defaultRetentionDays: 90,
    });
  });

  it("collapses every phone shape onto one dedupe key", () => {
    const shapes = ["8097974258", "+918097974258", "08097974258", "+91 80979 74258"];
    const keys = new Set(
      shapes.map((mobile) => {
        const result = validateIngestedLead(portalLead({ mobile }));
        return result.ok ? result.lead.dedupeKey : `ERROR:${result.errors.join()}`;
      }),
    );
    expect([...keys]).toEqual(["+918097974258"]);
  });

  it("gives first-party form leads automation permissions, portal leads only human touch", () => {
    const firstParty = validateIngestedLead(
      portalLead({
        source: "architech-website",
        consent: { consentClass: "first-party-form", capturedAt: "2026-09-08T10:14:00Z", evidence: "architech:enquiry:abc123" },
      }),
    );
    expect(firstParty.ok && firstParty.lead.consent.permissions.automatedWhatsAppFirstTouch).toBe(true);

    const portal = validateIngestedLead(portalLead());
    expect(portal.ok && portal.lead.consent.permissions.automatedWhatsAppFirstTouch).toBe(false);
  });

  it("locks ad-opt-in automated WhatsApp behind the form's WhatsApp opt-in evidence", () => {
    const withoutEvidence = validateIngestedLead(
      portalLead({
        source: "meta-ads",
        consent: { consentClass: "ad-opt-in", capturedAt: "2026-09-08T10:14:00Z", evidence: "meta:leadform:77" },
      }),
    );
    /* The contract is honest about this: it validates, but the resolved
       permission stays human-only until the checkbox evidence exists. */
    expect(withoutEvidence.ok).toBe(true);
    if (withoutEvidence.ok) {
      expect(withoutEvidence.lead.consent.permissions.automatedWhatsAppFirstTouch).toBe(false);
    }

    const withEvidence = validateIngestedLead(
      portalLead({
        source: "meta-ads",
        consent: {
          consentClass: "ad-opt-in",
          capturedAt: "2026-09-08T10:14:00Z",
          evidence: "meta:leadform:77",
          whatsappOptInEvidence: "meta:leadform:77:whatsapp-checkbox",
        },
      }),
    );
    expect(withEvidence.ok && withEvidence.lead.consent.permissions.automatedWhatsAppFirstTouch).toBe(true);
  });

  it("rejects unknown sources and unknown consent classes instead of guessing", () => {
    const unknownSource = validateIngestedLead(portalLead({ source: "sms-blast" as never }));
    expect(unknownSource.ok).toBe(false);
    if (!unknownSource.ok) expect(unknownSource.errors[0]).toContain("Unknown lead source");

    const unknownConsent = validateIngestedLead(
      portalLead({ consent: { consentClass: "bought-list" as never, capturedAt: "2026-09-08T10:14:00Z", evidence: "x" } }),
    );
    expect(unknownConsent.ok).toBe(false);
    if (!unknownConsent.ok) expect(unknownConsent.errors.some((e) => e.includes("Unknown consent class"))).toBe(true);
  });

  it("requires a reachable Indian mobile", () => {
    const landline = validateIngestedLead(portalLead({ mobile: "02226257777" }));
    expect(landline.ok).toBe(false);
    if (!landline.ok) expect(landline.errors.some((e) => e.startsWith("mobile:"))).toBe(true);
  });

  it("requires consent provenance -- an adapter cannot emit a lead without it", () => {
    const noConsent = validateIngestedLead(portalLead({ consent: undefined as never }));
    expect(noConsent.ok).toBe(false);
    if (!noConsent.ok) expect(noConsent.errors.some((e) => e.includes("consent.capturedAt is required"))).toBe(true);

    const noEvidence = validateIngestedLead(
      portalLead({ consent: { consentClass: "portal-shared", capturedAt: "2026-09-08T10:14:00Z", evidence: "  " } }),
    );
    expect(noEvidence.ok).toBe(false);
    if (!noEvidence.ok) expect(noEvidence.errors.some((e) => e.includes("consent.evidence is required"))).toBe(true);
  });

  it("rejects inverted and out-of-bounds budgets", () => {
    const inverted = validateIngestedLead(portalLead({ budgetMinInr: 11_000_000, budgetMaxInr: 10_000_000 }));
    expect(inverted.ok).toBe(false);

    const absurd = validateIngestedLead(portalLead({ budgetMinInr: 1e15 }));
    expect(absurd.ok).toBe(false);
  });

  it("requires a name and bounds every string to Frappe's varchar(140)", () => {
    const anonymous = validateIngestedLead(portalLead({ name: {} }));
    expect(anonymous.ok).toBe(false);
    if (!anonymous.ok) expect(anonymous.errors.some((e) => e.includes("first or full name"))).toBe(true);

    const overlong = validateIngestedLead(portalLead({ remarks: "x".repeat(141) }));
    expect(overlong.ok).toBe(false);
    if (!overlong.ok) expect(overlong.errors.some((e) => e.includes("exceeds 140"))).toBe(true);
  });

  it("builds bounded, stable idempotency keys per source lead", () => {
    const a = ingestIdempotencyKey("property-portal-1", "MB-59679995-8821");
    const b = ingestIdempotencyKey("property-portal-1", "MB-59679995-8821");
    const c = ingestIdempotencyKey("property-portal-2", "MB-59679995-8821");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBeLessThanOrEqual(128);
    expect(a.startsWith(`lead.ingest.property-portal-1.v${LEAD_INGESTION_CONTRACT_VERSION}.`)).toBe(true);

    /* A huge provider id must hash, not truncate -- truncation would collide
       two different leads onto one CRM record. */
    const huge = ingestIdempotencyKey("property-portal-3", "9".repeat(400));
    expect(huge.length).toBeLessThanOrEqual(128);
    expect(huge).not.toContain("99999");
  });

  it("keeps the source registry and consent classes internally consistent", () => {
    for (const [id, definition] of Object.entries(LEAD_SOURCES)) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
    for (const [id, permissions] of Object.entries(CONSENT_CLASSES)) {
      expect(permissions.defaultRetentionDays).toBeGreaterThan(0);
      /* A class that forbids human contact is useless; a class that allows
         automation must at least allow human contact. */
      expect(permissions.humanFirstTouch).toBe(true);
      if (permissions.automatedWhatsAppFirstTouch || permissions.automatedEmail) {
        expect(permissions.humanFirstTouch).toBe(true);
      }
      expect(consentPermissionsFor(id as keyof typeof CONSENT_CLASSES)).not.toHaveProperty("definition");
    }
  });
});
