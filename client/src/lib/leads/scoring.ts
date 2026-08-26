/* Deterministic lead scoring (P1-LEAD-002).
   A transparent, auditable heuristic that ranks a lead by signal strength so the
   agent desk can prioritize follow-up. Pure and server-safe; the score is derived
   from *structured facts* on the lead (message length, explicit intent keywords,
   consent present, contact completeness) — not from any ML model or invented
   signals. Exposed alongside the lead so it is explainable, not a black box. */

import type { LeadRecord } from "./lead";

export type LeadIntentKeyword = "visit" | "price" | "negotiat" | "offer" | "loan" | "immediate" | "serious" | "today";

export const LEAD_INTENT_KEYWORDS: LeadIntentKeyword[] = ["visit", "price", "negotiat", "offer", "loan", "immediate", "serious", "today"];

export type LeadScore = {
  score: number; // 0..100
  grade: "hot" | "warm" | "cold";
  signals: string[];
};

const INTENT_WEIGHT = 30;
const LENGTH_WEIGHT = 25;
const CONTACT_WEIGHT = 20;
const CONSENT_WEIGHT = 15;
const EMAIL_WEIGHT = 10;

export function scoreLead(lead: Pick<LeadRecord, "message" | "name" | "phoneMasked" | "consentText" | "email">): LeadScore {
  const signals: string[] = [];
  let score = 0;

  const message = lead.message?.trim() ?? "";
  const lower = message.toLowerCase();

  const intentHits = LEAD_INTENT_KEYWORDS.filter((keyword) => lower.includes(keyword));
  if (intentHits.length > 0) {
    score += INTENT_WEIGHT;
    signals.push(`Intent keywords: ${intentHits.slice(0, 3).join(", ")}`);
  } else {
    signals.push("No explicit intent keyword");
  }

  if (message.length >= 60) {
    score += LENGTH_WEIGHT;
    signals.push("Detailed message (≥60 chars)");
  } else if (message.length >= 25) {
    score += Math.round(LENGTH_WEIGHT * 0.5);
    signals.push("Moderate message length");
  } else {
    signals.push("Short message");
  }

  if (lead.phoneMasked && lead.phoneMasked !== "••••") {
    score += CONTACT_WEIGHT;
    signals.push("Contact number present");
  }
  if (lead.email) {
    score += EMAIL_WEIGHT;
    signals.push("Email present");
  }
  if (lead.consentText && lead.consentText.trim().length >= 12) {
    score += CONSENT_WEIGHT;
    signals.push("Consent on file");
  } else {
    signals.push("Consent missing");
  }

  const grade = score >= 75 ? "hot" : score >= 45 ? "warm" : "cold";
  return { score: Math.min(100, score), grade, signals };
}

export function leadGradeLabel(grade: LeadScore["grade"]): string {
  return grade === "hot" ? "Hot" : grade === "warm" ? "Warm" : "Cold";
}
