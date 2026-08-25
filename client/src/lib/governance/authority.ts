/* Authority-baseline & outreach governance (P1-OFF-001).
   Models the compliance gates for legitimate off-page authority work: every
   outreach link/asset must carry a disclosure, be non-paid (no ranking-passing
   links), and be recorded in an auditable registry. Deterministic + server-safe.

   This deliberately encodes the SEO-008 rule: Phase 1 does legit authority work
   WITHOUT paid ranking-passing links or manipulative exchanges. */

export type DisclosureStatus = "required" | "declared" | "n-a";
export type AuthorityAssetType = "guide" | "local-report" | "field-note" | "press" | "partner";

export type AuthorityAsset = {
  id: string;
  type: AuthorityAssetType;
  title: string;
  url?: string;
  /** True only for nofollow / non-ranking-passing links. */
  isNofollow: boolean;
  /** Paid placement is disallowed by policy. */
  paidForLink: boolean;
  disclosure: DisclosureStatus;
  relationshipRegistry?: string;
};

export type OutreachEntry = {
  id: string;
  date: string;
  target: string;
  assetId?: string;
  outcome: "sent" | "accepted" | "declined";
  reviewedBy?: string;
};

export type GovernanceDecision = {
  ok: boolean;
  reasons: string[];
};

export function validateAuthorityAsset(asset: AuthorityAsset): GovernanceDecision {
  const reasons: string[] = [];
  if (asset.paidForLink) reasons.push("Paid links are not allowed in Phase 1 authority work.");
  if (!asset.isNofollow && asset.type !== "guide" && asset.type !== "local-report") reasons.push("External links must be nofollow unless they are owned authority content.");
  if (asset.url && asset.disclosure !== "declared" && asset.disclosure !== "n-a") reasons.push("A disclosure statement is required for this link.");
  return { ok: reasons.length === 0, reasons };
}

export function validateOutreach(entry: OutreachEntry, assets: AuthorityAsset[] = []): GovernanceDecision {
  const reasons: string[] = [];
  if (entry.outcome === "accepted") {
    if (!entry.assetId) reasons.push("Accepted outreach must reference a registry asset.");
    if (!entry.reviewedBy) reasons.push("Accepted outreach must be reviewed by a named owner.");
  }
  if (entry.assetId) {
    const asset = assets.find((item) => item.id === entry.assetId);
    if (!asset) reasons.push(`Registry asset not found: ${entry.assetId}`);
    else if (!validateAuthorityAsset(asset).ok) reasons.push(...validateAuthorityAsset(asset).reasons);
  }
  return { ok: reasons.length === 0, reasons };
}

export const AUTHORITY_DISCLOSURE_POLICY = [
  "All external links from Architech are nofollow unless the target is owned authority content (guide, local report, field note).",
  "No paid or ranking-passing links are permitted; any placement must be disclosed and be value-neutral.",
  "Every accepted outreach is recorded with a named reviewer and links to a registry asset.",
] as const;
