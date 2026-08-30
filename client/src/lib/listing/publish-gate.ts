/* The publish gate.

   `validateListingDraft` already refuses a malformed draft at creation time:
   title, price, BHK, area, locality, type, availability, a 30-character
   description, and confirmed media rights. A gate that re-checked those would
   be a second lock on a door that is already locked, so this module checks
   what *only* can be checked at the moment of publication:

     1. Whether photographs were actually attached. Draft creation only
        confirms the broker has the rights to publish media, never that any
        exists — and the site cannot render a listing without one.
     2. Whether the description says anything. Thirty characters passes draft
        creation and is roughly one clause.
     3. Whether this is a near-duplicate of a listing already published in the
        same locality. This is the broker copy-paste case and it is the common
        one.
     4. Whether RERA registration is present where it is mandatory.

   The gate is blocking, and that is a deliberate departure from how the rest
   of this codebase treats quality — `page-quality.ts` is a report, and
   `ai/moderation.ts` raises warnings nobody is obliged to act on. A report
   tells you a thin listing exists after it is already indexed; a gate stops it
   getting there. The cost of a gate is that it can be wrong in the direction
   of refusing something publishable, which is why every rejection carries
   reasons a broker can act on rather than a boolean. A gate that returns
   `false` is a wall.

   Three outcomes, not two. `canonicalize` is the one that matters: a
   near-duplicate is not refused, it is pointed at the listing it duplicates.
   The inventory stays visible and Google gets one page instead of two
   competing ones. A duplicate that is also incomplete is `block`ed —
   canonicalization never privileges a description over the media/quality
   gate.

   Pure by design — it takes a subject and its peers and returns a decision.
   It reads no repository and touches no clock, so the rules can be tested
   against cases rather than against fixtures. */
import type { AvailabilityCode, PropertyTypeCode } from "@/lib/listing-vocabulary";

/* RERA registration is mandatory in India for a project sold before it is
   completed. An individual reselling their own flat is generally outside it,
   which is why this is a blocker for off-plan availability and only a warning
   otherwise — `ai/moderation.ts` already calls a missing RERA number a
   warning, and promoting that to a blocker everywhere would refuse the
   majority of legitimate resale inventory. */
const RERA_MANDATORY_AVAILABILITY: ReadonlySet<AvailabilityCode> = new Set<AvailabilityCode>([
  "NEW_LAUNCH",
  "UNDER_CONSTRUCTION",
  "PRE_LAUNCH",
]);

/** Below this the page has essentially no editorial copy of its own. */
export const MIN_DESCRIPTION_CHARS = 80;
/** Above `MIN_DESCRIPTION_CHARS` but below this, the page leans entirely on
    structured fields and duplicates the shape of every other listing. */
export const THIN_DESCRIPTION_CHARS = 200;

/** Character-trigram Jaccard above which two descriptions are the same copy. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.75;

/** A listing cannot be rendered without at least one photograph of itself. */
export const MIN_PUBLISHABLE_MEDIA = 1;

export type PublishGateAction = "publish" | "canonicalize" | "block";

export type PublishGateSubject = {
  stableId: string;
  draftId?: string;
  title: string;
  description: string;
  priceInr: number;
  bhk: number;
  areaSqft: number;
  propertyType: PropertyTypeCode;
  availability: AvailabilityCode;
  localitySlug: string;
  reraNumber?: string;
  mediaRightsConfirmed: boolean;
  mediaCount: number;
};

export type PublishGatePeer = {
  stableId: string;
  title: string;
  description: string;
  localitySlug: string;
  /** Whether the peer is already publicly visible.

      Canonicalizing to a listing that is not itself published would point
      Google at a page that does not exist, so an unpublished near-duplicate
      can only ever raise a warning. */
  published: boolean;
};

export type PublishGateDecision = {
  action: PublishGateAction;
  /** Reasons the listing may not publish. Each is a sentence a broker can act
      on; never a bare code. */
  blockers: string[];
  /** Things worth fixing that do not justify refusing the listing. */
  warnings: string[];
  canonicalToListingId?: string;
  /** Similarity to the canonical target, for the audit trail. */
  similarity?: number;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(text: string): Set<string> {
  const padded = `  ${normalize(text)} `;
  const grams = new Set<string>();
  for (let index = 0; index < padded.length - 2; index += 1) {
    grams.add(padded.slice(index, index + 3));
  }
  return grams;
}

/* Character trigrams rather than word shingles, and Jaccard rather than
   cosine, because the failure being detected is a broker pasting the same
   paragraph and changing three words. Word-level comparison reads that as a
   different document; character trigrams see the shared body. Jaccard is
   length-tolerant in the way that matters here — padding a duplicate with
   extra sentences does not move it much, which is exactly the evasion we care
   about. */
export function descriptionSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

/** The most similar already-published peer in the same locality. */
function nearestPublishedDuplicate(
  subject: PublishGateSubject,
  peers: PublishGatePeer[],
): { peer: PublishGatePeer; similarity: number } | null {
  let best: { peer: PublishGatePeer; similarity: number } | null = null;

  for (const peer of peers) {
    if (peer.stableId === subject.stableId) continue;
    // Duplicates only compete within a locality. The same paragraph used in
    // two cities is not a duplicate page; in one city it is.
    if (peer.localitySlug !== subject.localitySlug) continue;
    if (!peer.published) continue;

    const similarity = descriptionSimilarity(subject.description, peer.description);
    if (similarity < DUPLICATE_SIMILARITY_THRESHOLD) continue;
    if (!best || similarity > best.similarity) best = { peer, similarity };
  }

  return best;
}

export function evaluatePublishGate(subject: PublishGateSubject, peers: PublishGatePeer[] = []): PublishGateDecision {
  const blockers: string[] = [];
  const warnings: string[] = [];

  /* Completeness that only becomes knowable at publication time. */

  if (subject.mediaCount < MIN_PUBLISHABLE_MEDIA) {
    blockers.push(
      "Attach at least one photograph of this property. A listing cannot be published without one, and the site will not substitute a generic image.",
    );
  }
  if (!subject.mediaRightsConfirmed) {
    blockers.push("Confirm media rights before publishing. Without confirmation the photographs cannot be shown.");
  }

  const descriptionLength = subject.description.trim().length;
  if (descriptionLength < MIN_DESCRIPTION_CHARS) {
    blockers.push(
      `The description is ${descriptionLength} characters. Write at least ${MIN_DESCRIPTION_CHARS} — a few sentences about this specific home, not a restatement of the fields above it.`,
    );
  } else if (descriptionLength < THIN_DESCRIPTION_CHARS) {
    warnings.push(
      `The description is ${descriptionLength} characters, which is thin. The page will lean on structured fields and look like every other listing; aim for ${THIN_DESCRIPTION_CHARS}+.`,
    );
  }

  /* RERA: mandatory off-plan, advisory otherwise. */

  if (!subject.reraNumber && RERA_MANDATORY_AVAILABILITY.has(subject.availability)) {
    blockers.push(
      `A RERA number is required for ${subject.availability.toLowerCase().replace(/_/g, " ")} listings. Add it, or change the availability status if this is a resale.`,
    );
  } else if (!subject.reraNumber) {
    warnings.push("No RERA number. Verify whether this listing requires one before it goes live.");
  }

  /* Duplication. A near-duplicate is not refused — it is pointed at the
     listing it duplicates, so Google gets one page instead of two competing
     ones. But only if the target is itself published AND the subject is
     otherwise publishable. A duplicate that is also incomplete must be
     blocked: letting a photo-less listing through because its description
     matches a published peer would bypass the media/quality gate. */

  const duplicate = nearestPublishedDuplicate(subject, peers);
  if (duplicate) {
    const canonical = {
      canonicalToListingId: duplicate.peer.stableId,
      similarity: Number(duplicate.similarity.toFixed(4)),
    };
    if (blockers.length === 0) {
      return { action: "canonicalize", blockers, warnings, ...canonical };
    }
    warnings.push(
      `This description is a ${Math.round(duplicate.similarity * 100)}% match for an already-published listing in the same locality. Fix the blockers below and it will be canonicalized to that listing instead of being published as a second page.`,
    );
    return { action: "block", blockers, warnings, ...canonical };
  }

  const unpublishedDuplicate = peers.some(
    (peer) =>
      peer.stableId !== subject.stableId &&
      peer.localitySlug === subject.localitySlug &&
      !peer.published &&
      descriptionSimilarity(subject.description, peer.description) >= DUPLICATE_SIMILARITY_THRESHOLD,
  );
  if (unpublishedDuplicate) {
    warnings.push(
      "A similar description is already in review for this locality. If these are the same property, only one will keep its own page.",
    );
  }

  return { action: blockers.length > 0 ? "block" : "publish", blockers, warnings };
}
