# Architech Domain Contracts

These contracts are implementation boundaries. The exact TypeScript/Zod/Prisma representation may evolve, but the invariants and acceptance behavior are normative.

## Contract rules

Every contract must define identity, ownership, input validation, output shape, authorization, provenance, lifecycle, errors, retries, observability, privacy, and deletion behavior. Unknown fields must not be silently trusted. External facts must carry source and retrieval metadata.

## Listing contract

```ts
type ListingStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'temporarily_unavailable'
  | 'sold'
  | 'rented'
  | 'expired'
  | 'archived'
  | 'deleted'

type Listing = {
  id: string                 // immutable public identity
  stableSlug: string         // route-safe identity component
  title: string
  transaction: 'buy' | 'rent'
  propertyType: string
  cityId: string
  localityId: string
  projectId?: string
  brokerOrganizationId?: string
  status: ListingStatus
  price?: { amount: number; currency: 'INR'; period?: 'month' | 'one_time' }
  area?: { value: number; unit: 'sqft' | 'sqm' | 'acre' }
  bedrooms?: number
  bathrooms?: number
  facts: VerifiedFact[]
  mediaIds: string[]
  reraReferenceIds: string[]
  publishedAt?: string
  lastMeaningfulEdit?: string
  version: number
}
```

Acceptance rules: the public page never invents missing fields; inactive listings follow lifecycle URL rules; mutable titles never change the stable ID; every material update creates an audit/version event; and only approved fields appear in JSON-LD.

## Broker contract

```ts
type BrokerProfile = {
  id: string
  organizationId: string
  displayName: string
  verification: 'unverified' | 'pending' | 'verified' | 'suspended'
  contactPolicy: 'masked_default' | 'consented_direct'
  mediaRightsStatus: 'missing' | 'pending' | 'approved' | 'revoked'
  descriptionStatus: 'draft' | 'moderation' | 'approved' | 'rejected'
  reraReferences: string[]
  auditTrailId: string
}
```

Acceptance rules: broker claims are reviewable; direct contact is never silently enabled; suspended brokers cannot publish; public profiles display verification state and evidence policy; and descriptions are plain text or sanitized through an approved allowlist.

## Lead contract

```ts
type LeadContactMode = 'masked' | 'consented_direct'
type LeadStatus =
  | 'created'
  | 'consent_pending'
  | 'consented'
  | 'queued'
  | 'delivered'
  | 'acknowledged'
  | 'failed_retryable'
  | 'failed_permanent'
  | 'spam'
  | 'deleted'

type Lead = {
  id: string
  listingId?: string
  projectId?: string
  brokerOrganizationId?: string
  userId?: string
  contactMode: LeadContactMode
  status: LeadStatus
  consentRecordId: string
  idempotencyKey: string
  deliveryAttempts: number
  nextRetryAt?: string
  retentionExpiresAt: string
  deletedAt?: string
}
```

Acceptance rules: masked contact is default; direct contact requires explicit user action and recorded consent; delivery is idempotent; retryable failures use bounded exponential backoff; permanent failures enter a reviewable dead-letter state; spam is isolated; deletion removes or anonymizes personal data according to the approved retention schedule; every state transition is audited.

## Moderation contract

```ts
type ModerationDecision = 'pending' | 'approved' | 'rejected' | 'needs_changes' | 'escalated'
type ModerationSubject = 'listing' | 'broker' | 'media' | 'guide' | 'lead_message'

type ModerationCase = {
  id: string
  subjectType: ModerationSubject
  subjectId: string
  decision: ModerationDecision
  rulesTriggered: string[]
  reviewerId?: string
  evidence: EvidenceRef[]
  createdAt: string
  decidedAt?: string
}
```

Acceptance rules: first-time or high-risk broker content can require human review; moderation cannot remove provenance; rejected content is not publicly indexable; appeals and correction events are retained; and automated classifiers never make unsupported RERA or legal determinations without review.

## Media contract

```ts
type MediaAsset = {
  id: string
  ownerType: 'listing' | 'project' | 'broker' | 'guide'
  ownerId: string
  kind: 'image' | 'video' | 'document'
  sourceKey: string
  derivatives: string[]
  rightsStatus: 'missing' | 'pending' | 'approved' | 'revoked'
  moderationStatus: 'pending' | 'approved' | 'rejected'
  exifRemoved: boolean
  malwareScan: 'pending' | 'clean' | 'blocked'
  retentionExpiresAt?: string
  caption?: string
  transcriptId?: string
}
```

Acceptance rules: media cannot become public before authorization and safety checks pass; revocation removes public delivery and updates dependent pages; images have accessible alt/caption policy; video has poster/caption/transcript fallback; and derivatives are reproducible.

## RERA provenance contract

```ts
type EvidenceRef = {
  sourceUrl: string
  sourceName: string
  retrievedAt: string
  parserVersion?: string
  confidence?: number
  checksum?: string
  excerpt?: string
}

type ReraRecord = {
  id: string
  registrationNumber: string
  state: string
  projectId?: string
  status: 'unverified' | 'pending' | 'verified' | 'stale' | 'disputed'
  evidence: EvidenceRef[]
  lastVerifiedAt?: string
  correctionCaseId?: string
}
```

Acceptance rules: no public “verified” label without approved evidence; stale records show freshness state; disputed records are escalated; source and retrieval data are visible according to the approved public-record policy; and legal approval covers ingestion and republication.

## SEO page contract

```ts
type SeoPageStatus = 'draft' | 'quality_review' | 'approved' | 'published' | 'noindex' | 'retired'
type IndexPolicy = 'index' | 'noindex' | 'canonical_redirect' | 'not_found' | 'gone'

type SeoPage = {
  id: string
  canonicalUrl: string
  locale: string
  pageType: 'home' | 'hub' | 'city' | 'locality' | 'intent' | 'project' | 'listing' | 'broker' | 'rera' | 'guide'
  primaryIntent: string
  entityId: string
  status: SeoPageStatus
  indexPolicy: IndexPolicy
  qualityScore?: number
  evidenceStatus: 'missing' | 'partial' | 'approved'
  lastMeaningfulEdit?: string
  ownerTeam: string
  canonicalVersion: number
}
```

Acceptance rules: one canonical URL per indexable intent; visible facts, metadata, JSON-LD, sitemap membership, and canonical URL come from one snapshot; pages cannot be indexable while required quality/evidence gates fail; and no arbitrary facet combination can bypass policy.

## Lifecycle contract

```ts
type LifecycleResponse =
  | { http: 200; indexPolicy: 'index' | 'noindex' }
  | { http: 301; destination: string }
  | { http: 404 }
  | { http: 410 }
```

Acceptance rules: active useful pages can return 200; temporary states may return 200/noindex or a product-approved response; permanent replacements use one-step 301 redirects; deleted content returns 404 or 410 according to policy; redirect chains are rejected; and sitemaps contain only permitted canonical URLs.

## Contract implementation requirements

Contracts must be implemented in TypeScript/Zod at API boundaries, Prisma/database constraints where practical, and contract tests in CI. Every contract needs fixtures for success, missing data, invalid data, unauthorized access, stale data, retry, deletion, and rollback.
