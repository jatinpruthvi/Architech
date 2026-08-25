export type ReraVerificationStatus = "VERIFIED" | "STALE" | "DISPUTED" | "NOT_FOUND";
export type ReraCorrectionStatus = "NONE" | "REQUESTED" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export type ReraRecordSnapshot = {
  registrationNumber: string;
  state: "Gujarat";
  promoterName: string;
  projectName: string;
  sourceUrl: string;
  retrievedAt: string;
  parserVersion: string;
  confidence: number;
  verificationStatus: ReraVerificationStatus;
  correctionStatus: ReraCorrectionStatus;
  evidence: {
    source: "demo-rera-adapter" | "gujarat-rera";
    fieldsMatched: string[];
    visibleDisclaimer: string;
  };
  auditTrail: ReraAuditEvent[];
};

export type ReraAuditEvent = {
  id: string;
  action: string;
  actor: string;
  at: string;
  metadata?: Record<string, unknown>;
};

export type ReraCorrectionInput = {
  registrationNumber: string;
  field: string;
  currentValue?: string;
  proposedValue: string;
  reason: string;
  reporterEmail?: string;
};

export type ReraCorrection = ReraCorrectionInput & {
  id: string;
  status: ReraCorrectionStatus;
  createdAt: string;
  auditTrail: ReraAuditEvent[];
};

const now = new Date("2026-08-24T12:00:00.000Z");

const records = new Map<string, ReraRecordSnapshot>([
  [
    "GJ/RERA/AHM/2026/04821-DEMO",
    {
      registrationNumber: "GJ/RERA/AHM/2026/04821-DEMO",
      state: "Gujarat",
      promoterName: "Nivasa Partners",
      projectName: "Architech Paldi Garden Courtyard Demo",
      sourceUrl: "https://gujrera.gujarat.gov.in/",
      retrievedAt: now.toISOString(),
      parserVersion: "demo-rera-adapter-v1",
      confidence: 0.92,
      verificationStatus: "VERIFIED",
      correctionStatus: "NONE",
      evidence: {
        source: "demo-rera-adapter",
        fieldsMatched: ["registrationNumber", "promoterName", "projectName", "state"],
        visibleDisclaimer: "Demo adapter: production must verify against the official Gujarat RERA registry before publication.",
      },
      auditTrail: [
        { id: "audit_rera_seed", action: "rera.record.seeded", actor: "system", at: now.toISOString(), metadata: { source: "phase1-demo-fixture" } },
      ],
    },
  ],
]);

const corrections = new Map<string, ReraCorrection>();

function stableId(prefix: string, seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

function audit(action: string, actor: string, metadata?: Record<string, unknown>): ReraAuditEvent {
  return { id: stableId("audit", `${action}:${actor}:${Date.now()}:${Math.random()}`), action, actor, at: new Date().toISOString(), metadata };
}

export function normalizeReraNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateReraNumber(value: string): boolean {
  return /^GJ\/RERA\/[A-Z]+\/\d{4}\/\d{5}(?:-[A-Z]+)?$/.test(normalizeReraNumber(value));
}

export function getReraRecord(registrationNumber: string): ReraRecordSnapshot | undefined {
  return records.get(normalizeReraNumber(registrationNumber));
}

export function verifyReraRecord(registrationNumber: string) {
  const normalized = normalizeReraNumber(registrationNumber);
  if (!validateReraNumber(normalized)) {
    return { ok: false as const, status: 400, errors: ["Registration number format is invalid for Gujarat RERA."] };
  }
  const record = getReraRecord(normalized);
  if (!record) {
    return { ok: true as const, record: null, verificationStatus: "NOT_FOUND" as const };
  }
  return { ok: true as const, record, verificationStatus: record.verificationStatus };
}

export function markReraStale(registrationNumber: string, reason = "Scheduled freshness check required.") {
  const record = getReraRecord(registrationNumber);
  if (!record) return { ok: false as const, status: 404, errors: ["RERA record not found."] };
  record.verificationStatus = "STALE";
  record.auditTrail.push(audit("rera.record.marked_stale", "system", { reason }));
  return { ok: true as const, record };
}

export function requestReraCorrection(input: ReraCorrectionInput) {
  const normalized = normalizeReraNumber(input.registrationNumber);
  const verification = verifyReraRecord(normalized);
  if (!verification.ok) return verification;
  if (!input.field || input.field.trim().length < 2) return { ok: false as const, status: 400, errors: ["Correction field is required."] };
  if (!input.proposedValue || input.proposedValue.trim().length < 2) return { ok: false as const, status: 400, errors: ["Proposed value is required."] };
  if (!input.reason || input.reason.trim().length < 10) return { ok: false as const, status: 400, errors: ["Correction reason must be at least 10 characters."] };

  const id = stableId("rera_correction", `${normalized}:${input.field}:${input.proposedValue}`);
  const existing = corrections.get(id);
  if (existing) return { ok: true as const, correction: existing, duplicate: true };

  const correction: ReraCorrection = {
    ...input,
    registrationNumber: normalized,
    id,
    status: "REQUESTED",
    createdAt: new Date().toISOString(),
    auditTrail: [audit("rera.correction.requested", input.reporterEmail ?? "public", { field: input.field })],
  };
  corrections.set(id, correction);

  const record = getReraRecord(normalized);
  if (record) {
    record.correctionStatus = "REQUESTED";
    record.verificationStatus = "DISPUTED";
    record.auditTrail.push(audit("rera.record.disputed", input.reporterEmail ?? "public", { correctionId: id, field: input.field }));
  }

  return { ok: true as const, correction, duplicate: false };
}

export function resolveReraCorrection(correctionId: string, status: Exclude<ReraCorrectionStatus, "NONE" | "REQUESTED">, note: string) {
  const correction = corrections.get(correctionId);
  if (!correction) return { ok: false as const, status: 404, errors: ["Correction not found."] };
  correction.status = status;
  correction.auditTrail.push(audit(`rera.correction.${status.toLowerCase()}`, "moderator", { note }));
  const record = getReraRecord(correction.registrationNumber);
  if (record) {
    record.correctionStatus = status;
    record.verificationStatus = status === "RESOLVED" ? "VERIFIED" : record.verificationStatus;
    record.auditTrail.push(audit(`rera.record.correction_${status.toLowerCase()}`, "moderator", { correctionId }));
  }
  return { ok: true as const, correction, record };
}

export function resetReraStoreForTests() {
  corrections.clear();
  const record = records.get("GJ/RERA/AHM/2026/04821-DEMO");
  if (record) {
    record.verificationStatus = "VERIFIED";
    record.correctionStatus = "NONE";
    record.auditTrail = [record.auditTrail[0]];
  }
}
