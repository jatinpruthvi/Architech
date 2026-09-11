/* Listing lifecycle → HTTP & indexability behavior.
   Encodes the SEO-004 rule that listing lifecycle transitions produce correct
   200 / 301 / 404 / 410 responses, and the SEO-003 rule that non-public states
   are not indexable. Deterministic and server-safe. */

export type ListingLifecycle =
  | "DRAFT"
  | "IN_REVIEW"
  | "ACTIVE"
  | "SOLD"
  | "EXPIRED"
  | "REMOVED"
  | "DUPLICATE"
  | "ARCHIVED";

export type LifecycleOptions = { continuingValue?: boolean };

export type HttpBehavior =
  | { status: 200; indexable: boolean; redirectTo?: undefined }
  | { status: 410; indexable: false; redirectTo?: undefined }
  | { status: 404; indexable: false; redirectTo?: undefined }
  | { status: 301; indexable: false; redirectTo: string };

export type LifecycleRule = {
  status: 200 | 301 | 404 | 410;
  indexable: boolean;
  /** Destination for a 301; canonical stable id/slug target. */
  redirectTo?: string;
  note: string;
};

export const LIFECYCLE_RULES: Record<ListingLifecycle, LifecycleRule> = {
  DRAFT: { status: 404, indexable: false, note: "Not publicly viewable until reviewed." },
  IN_REVIEW: { status: 404, indexable: false, note: "Pending moderation; noindex." },
  ACTIVE: { status: 200, indexable: true, note: "Live and indexable." },
  SOLD: { status: 200, indexable: false, note: "Still viewable for context but noindexed." },
  EXPIRED: { status: 410, indexable: false, note: "Gone; 410 GONE so crawlers drop it." },
  REMOVED: { status: 410, indexable: false, note: "Removed by owner/moderator; 410 GONE." },
  DUPLICATE: { status: 301, indexable: false, redirectTo: "canonical", note: "Redirect to canonical listing." },
  ARCHIVED: { status: 404, indexable: false, note: "Archived; not publicly resolvable." },
};

/** Map a lifecycle to its HTTP/indexability behavior. */
export function behaviorForLifecycle(lifecycle: ListingLifecycle, options: LifecycleOptions = {}): HttpBehavior {
  const rule = LIFECYCLE_RULES[lifecycle];
  if (lifecycle === "EXPIRED" && options.continuingValue) return { status: 200, indexable: false };
  if (rule.status === 301 && rule.redirectTo) return { status: 301, indexable: false, redirectTo: rule.redirectTo };
  if (rule.status === 410) return { status: 410, indexable: false };
  if (rule.status === 404) return { status: 404, indexable: false };
  return { status: 200, indexable: rule.indexable };
}

/** True when a lifecycle is publicly viewable (200). */
export function isPubliclyViewable(lifecycle: ListingLifecycle): boolean {
  return behaviorForLifecycle(lifecycle).status === 200;
}

/** True when a lifecycle is indexable (only ACTIVE). */
export function isIndexable(lifecycle: ListingLifecycle): boolean {
  return behaviorForLifecycle(lifecycle).indexable;
}

/** Robust parse from a possibly unknown lifecycle string. A listing with no
    lifecycle recorded is treated as ACTIVE (the default for live inventory). */
export function parseLifecycle(value?: string | null): ListingLifecycle | "UNKNOWN" {
  const normalized = (value ?? "").trim().toUpperCase();
  if (!normalized) return "ACTIVE";
  if (normalized in LIFECYCLE_RULES) return normalized as ListingLifecycle;
  return "UNKNOWN";
}

/** Build the HTTP decision for a requested listing, treating unknown states as 404. */
export function httpDecisionForListing(lifecycle?: string | null, canonicalId?: string, options: LifecycleOptions = {}): HttpBehavior {
  const parsed = parseLifecycle(lifecycle);
  if (parsed === "UNKNOWN") return { status: 404, indexable: false };
  const behavior = behaviorForLifecycle(parsed, options);
  if (behavior.status === 301 && behavior.redirectTo === "canonical" && canonicalId) {
    return { status: 301, indexable: false, redirectTo: canonicalId };
  }
  return behavior;
}
