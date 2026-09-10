/* PROTOTYPE FIXTURE DATA for the mobile calling UX.

   STATUS: throwaway. Delete when Phase 2 (encrypted contact storage) and
   Phase 3 (POST /api/broker/leads/[id]/reveal) land — see
   docs/leads/mobile-calling-implementation-plan.md §7.

   WHY IT EXISTS AT ALL: the calling UI cannot be evaluated against the real
   inbox, because the real lead's phone number is discarded at write time
   (`prisma/schema.prisma:845` stores `phoneMasked` only). There is nothing to
   dial. So the ergonomics — thumb reach, the reveal round-trip, the
   plan-locked state, the post-call sheet — are prototyped against fixtures that
   carry the SAME contract shape the real API will return, and only the data
   source changes later.

   The numbers here are the canonical fake used across this repo's tests
   (+91 98765 43210, see lib/interop/phone.test.ts). They are not real
   subscribers and must never be replaced with a real number. */

import type { LeadStage, BrokerPlanStatus } from "./calling";
import type { LeadStatus } from "./lead";

export type PrototypeLead = {
  id: string;
  name: string;
  listingTitle: string;
  listingId: string;
  locality: string;
  city: string;
  message: string;
  status: LeadStatus;
  stage: LeadStage;
  consentText: string;
  consentClass: "first-party-form" | "portal-shared";
  phoneMasked: string;
  /** Stand-in for the decrypted ciphertext. Real code gets this only from the
      reveal endpoint, never in a list payload. */
  phoneE164: string;
  createdAt: string;
  score: number;
  grade: "hot" | "warm" | "cold";
  callAttempts: number;
  maxAttempts: number;
  suppressed: boolean;
  /** Present only for pre-migration leads, to exercise the NOT_STORED state. */
  contactStored: boolean;
  nextActionAt: string | null;
  history: Array<{ action: string; at: string }>;
};

export const PROTOTYPE_LEADS: PrototypeLead[] = [
  {
    id: "lead_prototype_hot",
    name: "Priya Shah",
    listingTitle: "3 BHK garden-facing apartment, Thaltej",
    listingId: "L-4471",
    locality: "Thaltej",
    city: "Ahmedabad",
    message:
      "We are looking to move before the school term starts, so this is urgent. Is the price negotiable, and can we visit this Saturday morning? We have a home loan pre-approval in place.",
    status: "NEW",
    stage: "NEW",
    consentText: "I agree that a verified Architech partner broker may contact me about this enquiry, including by phone call.",
    consentClass: "first-party-form",
    phoneMasked: "•••• ••• 4321",
    phoneE164: "+919876543210",
    createdAt: new Date(Date.now() - 42 * 60_000).toISOString(),
    score: 82,
    grade: "hot",
    callAttempts: 0,
    maxAttempts: 3,
    suppressed: false,
    contactStored: true,
    nextActionAt: null,
    history: [{ action: "lead.created", at: new Date(Date.now() - 42 * 60_000).toISOString() }],
  },
  {
    id: "lead_prototype_followup",
    name: "Rahul Mehta",
    listingTitle: "2 BHK resale flat, Bopal",
    listingId: "L-2210",
    locality: "Bopal",
    city: "Ahmedabad",
    message: "Called earlier, asked me to ring back after 6 pm when he is off work. Interested in a site visit next week.",
    status: "ACKNOWLEDGED",
    stage: "CONTACTED",
    consentText: "I agree that a verified Architech partner broker may contact me about this enquiry, including by phone call.",
    consentClass: "first-party-form",
    phoneMasked: "•••• ••• 4321",
    phoneE164: "+919876543210",
    createdAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    score: 58,
    grade: "warm",
    callAttempts: 1,
    maxAttempts: 3,
    suppressed: false,
    contactStored: true,
    nextActionAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    history: [
      { action: "lead.created", at: new Date(Date.now() - 26 * 3_600_000).toISOString() },
      { action: "call.no_answer", at: new Date(Date.now() - 20 * 3_600_000).toISOString() },
      { action: "lead.acknowledged", at: new Date(Date.now() - 19 * 3_600_000).toISOString() },
    ],
  },
  {
    id: "lead_prototype_attempts",
    name: "Ananya Iyer",
    listingTitle: "4 BHK penthouse, Sindhu Bhavan Road",
    listingId: "L-9087",
    locality: "Sindhu Bhavan Road",
    city: "Ahmedabad",
    message: "Enquired about the penthouse terrace and parking allocation. Would like the brochure before deciding on a visit.",
    status: "ACKNOWLEDGED",
    stage: "CONTACTED",
    consentText: "I agree that a verified Architech partner broker may contact me about this enquiry, including by phone call.",
    consentClass: "first-party-form",
    phoneMasked: "•••• ••• 4321",
    phoneE164: "+919876543210",
    createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    score: 44,
    grade: "warm",
    callAttempts: 3,
    maxAttempts: 3,
    suppressed: false,
    contactStored: true,
    nextActionAt: null,
    history: [
      { action: "lead.created", at: new Date(Date.now() - 4 * 86_400_000).toISOString() },
      { action: "call.no_answer", at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
      { action: "call.busy", at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
      { action: "call.no_answer", at: new Date(Date.now() - 86_400_000).toISOString() },
    ],
  },
  {
    id: "lead_prototype_suppressed",
    name: "Vikram Desai",
    listingTitle: "3 BHK villa, Shilaj",
    listingId: "L-6634",
    locality: "Shilaj",
    city: "Ahmedabad",
    message: "Not looking any more — we closed on another property last week. Please do not contact me again.",
    status: "CLOSED",
    stage: "LOST",
    consentText: "I agree that a verified Architech partner broker may contact me about this enquiry, including by phone call.",
    consentClass: "first-party-form",
    phoneMasked: "•••• ••• 4321",
    phoneE164: "+919876543210",
    createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    score: 20,
    grade: "cold",
    callAttempts: 2,
    maxAttempts: 3,
    suppressed: true,
    contactStored: true,
    nextActionAt: null,
    history: [
      { action: "lead.created", at: new Date(Date.now() - 9 * 86_400_000).toISOString() },
      { action: "call.not_interested", at: new Date(Date.now() - 7 * 86_400_000).toISOString() },
      { action: "contact.suppressed", at: new Date(Date.now() - 7 * 86_400_000).toISOString() },
      { action: "lead.closed", at: new Date(Date.now() - 7 * 86_400_000).toISOString() },
    ],
  },
  {
    id: "lead_prototype_not_stored",
    name: "Meera Nair",
    listingTitle: "2 BHK apartment, Maninagar",
    listingId: "L-1180",
    locality: "Maninagar",
    city: "Ahmedabad",
    message: "Older enquiry captured before encrypted contact storage existed, so its number was never retained.",
    status: "NEW",
    stage: "NEW",
    consentText: "I agree that a verified Architech partner broker may contact me about this enquiry.",
    consentClass: "portal-shared",
    phoneMasked: "•••• ••• 8802",
    phoneE164: "",
    createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    score: 30,
    grade: "cold",
    callAttempts: 0,
    maxAttempts: 3,
    suppressed: false,
    contactStored: false,
    nextActionAt: null,
    history: [{ action: "lead.created", at: new Date(Date.now() - 40 * 86_400_000).toISOString() }],
  },
];

export const PROTOTYPE_PLAN: BrokerPlanStatus = "ACTIVE";

export function findPrototypeLead(id: string): PrototypeLead | null {
  return PROTOTYPE_LEADS.find((lead) => lead.id === id) ?? null;
}
