import { getReraRecord, normalizeReraNumber, validateReraNumber, type ReraRecordSnapshot } from "./rera";

export type ReraProviderId = "demo-rera-adapter" | "gujarat-rera" | "unsupported-rera-jurisdiction";
export type ReraJurisdiction = {
  stateSlug: string;
  stateName: string;
  authorityName: string;
  publicRegistryUrl: string | null;
};

export type ReraProviderResult =
  | { ok: true; provider: ReraProviderId; jurisdiction: ReraJurisdiction; record: ReraRecordSnapshot | null; verificationStatus: ReraRecordSnapshot["verificationStatus"] | "NOT_FOUND"; provenance: ReraProvenance }
  | { ok: false; provider: ReraProviderId; jurisdiction: ReraJurisdiction; status: number; errors: string[] };

export type ReraProvenance = {
  sourceUrl: string;
  retrievedAt: string;
  parserVersion: string;
  legalGate: "LEG-001" | "LEG-004";
  disclaimer: string;
};

export interface ReraProvider {
  id: ReraProviderId;
  jurisdiction: ReraJurisdiction;
  verify(registrationNumber: string): Promise<ReraProviderResult>;
}

export const GUJARAT_RERA_JURISDICTION: ReraJurisdiction = {
  stateSlug: "gujarat",
  stateName: "Gujarat",
  authorityName: "Gujarat Real Estate Regulatory Authority",
  publicRegistryUrl: "https://gujrera.gujarat.gov.in/",
};

/** Explicit no-adapter result. Crucially, this does not route the number through
 * Gujarat validation or return a demo verified record. */
export class UnsupportedReraProvider implements ReraProvider {
  id = "unsupported-rera-jurisdiction" as const;
  constructor(public jurisdiction: ReraJurisdiction) {}
  async verify(_registrationNumber: string): Promise<ReraProviderResult> {
    return {
      ok: false,
      provider: this.id,
      jurisdiction: this.jurisdiction,
      status: 501,
      errors: [`RERA verification is not configured for ${this.jurisdiction.stateName}. No verification badge may be awarded.`],
    };
  }
}

export class DemoReraProvider implements ReraProvider {
  id = "demo-rera-adapter" as const;
  jurisdiction = GUJARAT_RERA_JURISDICTION;
  async verify(registrationNumber: string): Promise<ReraProviderResult> {
    const normalized = normalizeReraNumber(registrationNumber);
    if (!validateReraNumber(normalized)) return { ok: false, provider: this.id, jurisdiction: this.jurisdiction, status: 400, errors: ["Registration number format is invalid for the configured Gujarat demo adapter."] };
    const record = getReraRecord(this.jurisdiction.stateSlug, normalized) ?? null;
    return {
      ok: true,
      provider: this.id,
      jurisdiction: this.jurisdiction,
      record,
      verificationStatus: record?.verificationStatus ?? "NOT_FOUND",
      provenance: {
        sourceUrl: this.jurisdiction.publicRegistryUrl!,
        retrievedAt: new Date().toISOString(),
        parserVersion: "demo-rera-adapter-v1",
        legalGate: "LEG-001",
        disclaimer: "Demo adapter only. Production verification requires approved access to the applicable authority source.",
      },
    };
  }
}

export class GujaratReraProvider implements ReraProvider {
  id = "gujarat-rera" as const;
  jurisdiction = GUJARAT_RERA_JURISDICTION;
  constructor(private env: Partial<Record<"GUJARAT_RERA_BASE_URL" | "GUJARAT_RERA_API_KEY", string | undefined>> = process.env as Partial<Record<"GUJARAT_RERA_BASE_URL" | "GUJARAT_RERA_API_KEY", string | undefined>>) {}
  async verify(registrationNumber: string): Promise<ReraProviderResult> {
    const normalized = normalizeReraNumber(registrationNumber);
    if (!validateReraNumber(normalized)) return { ok: false, provider: this.id, jurisdiction: this.jurisdiction, status: 400, errors: ["Registration number format is invalid for Gujarat RERA."] };
    if (!this.env.GUJARAT_RERA_BASE_URL || !this.env.GUJARAT_RERA_API_KEY) {
      return { ok: false, provider: this.id, jurisdiction: this.jurisdiction, status: 503, errors: ["Gujarat RERA provider is not configured."] };
    }
    // Placeholder contract until legal-approved source access is available.
    return {
      ok: true,
      provider: this.id,
      jurisdiction: this.jurisdiction,
      record: null,
      verificationStatus: "NOT_FOUND",
      provenance: {
        sourceUrl: this.env.GUJARAT_RERA_BASE_URL,
        retrievedAt: new Date().toISOString(),
        parserVersion: "gujarat-rera-provider-v1-placeholder",
        legalGate: "LEG-001",
        disclaimer: "Live provider configured; official fetch/parser implementation remains behind legal/source approval.",
      },
    };
  }
}
