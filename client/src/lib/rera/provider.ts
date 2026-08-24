import { getReraRecord, normalizeReraNumber, validateReraNumber, type ReraRecordSnapshot } from "./rera";

export type ReraProviderId = "demo-rera-adapter" | "gujarat-rera";
export type ReraProviderResult =
  | { ok: true; provider: ReraProviderId; record: ReraRecordSnapshot | null; verificationStatus: ReraRecordSnapshot["verificationStatus"] | "NOT_FOUND"; provenance: ReraProvenance }
  | { ok: false; provider: ReraProviderId; status: number; errors: string[] };

export type ReraProvenance = {
  sourceUrl: string;
  retrievedAt: string;
  parserVersion: string;
  legalGate: "LEG-001" | "LEG-004";
  disclaimer: string;
};

export interface ReraProvider {
  id: ReraProviderId;
  verify(registrationNumber: string): Promise<ReraProviderResult>;
}

export class DemoReraProvider implements ReraProvider {
  id = "demo-rera-adapter" as const;
  async verify(registrationNumber: string): Promise<ReraProviderResult> {
    const normalized = normalizeReraNumber(registrationNumber);
    if (!validateReraNumber(normalized)) return { ok: false, provider: this.id, status: 400, errors: ["Registration number format is invalid for Gujarat RERA."] };
    const record = getReraRecord(normalized) ?? null;
    return {
      ok: true,
      provider: this.id,
      record,
      verificationStatus: record?.verificationStatus ?? "NOT_FOUND",
      provenance: {
        sourceUrl: "https://gujrera.gujarat.gov.in/",
        retrievedAt: new Date().toISOString(),
        parserVersion: "demo-rera-adapter-v1",
        legalGate: "LEG-001",
        disclaimer: "Demo adapter only. Production verification requires approved Gujarat RERA source terms.",
      },
    };
  }
}

export class GujaratReraProvider implements ReraProvider {
  id = "gujarat-rera" as const;
  constructor(private env: Partial<Record<"GUJARAT_RERA_BASE_URL" | "GUJARAT_RERA_API_KEY", string | undefined>> = process.env as Partial<Record<"GUJARAT_RERA_BASE_URL" | "GUJARAT_RERA_API_KEY", string | undefined>>) {}
  async verify(registrationNumber: string): Promise<ReraProviderResult> {
    const normalized = normalizeReraNumber(registrationNumber);
    if (!validateReraNumber(normalized)) return { ok: false, provider: this.id, status: 400, errors: ["Registration number format is invalid for Gujarat RERA."] };
    if (!this.env.GUJARAT_RERA_BASE_URL || !this.env.GUJARAT_RERA_API_KEY) {
      return { ok: false, provider: this.id, status: 503, errors: ["Gujarat RERA provider is not configured."] };
    }
    // Placeholder contract until legal-approved source access is available.
    return {
      ok: true,
      provider: this.id,
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
