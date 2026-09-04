/* "Next steps" — the only part of the dashboard that reasons ACROSS panels.
 *
 * This is what makes the page a dashboard rather than four lists side by side,
 * and it is the piece most likely to embarrass us: it tells a person what is
 * waiting on them, so a wrong prompt is worse than no prompt. Telling an owner
 * to "list your first property" when they already have three, or nagging a
 * buyer about a listing they cannot create, destroys trust in everything else
 * on the page.
 *
 * It lives here rather than inside the component so it can be tested against
 * every role and every data shape without a DOM. The component renders what
 * this returns and adds nothing of its own.
 *
 * Two rules hold for every prompt:
 *   1. Never prompt for something the persona's panel set does not include.
 *      A buyer has no listings panel, so a buyer is never told to list.
 *   2. Never prompt for something the session cannot act on. The caller passes
 *      the VISIBLE panels, so a locked panel produces no prompt -- an owner
 *      who cannot reach the listing form is not told to use it.
 */
import type { DashboardPanel } from "./panels";
import type { DashboardPersona } from "./persona";
import { PERSONA_META } from "./persona";

export type NextStep = { label: string; href: string };

/** Draft states, mirroring `DraftStatus` in lib/broker/workflow. */
export type DraftLike = { status: string };

export type NextStepsInput = {
  persona: DashboardPersona;
  /** Panels actually rendered for this session (visible, not locked). */
  panels: DashboardPanel[];
  requirementCount: number;
  drafts: DraftLike[];
  savedCount: number;
  leadCount: number;
  /** Organization verification, when the session has an organization. */
  verificationStatus?: string | null;
};

/* Statuses that need a human to move them along. ACTIVE is live; ARCHIVED,
   REJECTED and DUPLICATE are terminal, and nagging about those is noise. */
const ACTIONABLE_DRAFT_STATUSES = new Set(["DRAFT", "CHANGES_REQUESTED"]);

const VERIFIED_STATUSES = new Set(["VERIFIED_PARTNER", "RERA_VERIFIED"]);

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function buildNextSteps(input: NextStepsInput): NextStep[] {
  const { persona, panels, requirementCount, drafts, savedCount, leadCount, verificationStatus } = input;
  const shows = (panel: DashboardPanel) => panels.includes(panel);
  const steps: NextStep[] = [];

  if (shows("requirements") && requirementCount === 0) {
    steps.push({ label: "Tell us what you are looking for", href: "/requirements/" });
  }

  if (shows("my-listings") && drafts.length === 0) {
    steps.push({ label: "List your first property", href: "/broker/listings/new/" });
  }

  if (shows("my-listings")) {
    const actionable = drafts.filter((draft) => ACTIONABLE_DRAFT_STATUSES.has(draft.status)).length;
    if (actionable > 0) {
      steps.push({
        label: `${actionable} ${plural(actionable, "listing needs", "listings need")} your attention before going live`,
        href: "/broker/agent/my-listings/",
      });
    }

    const inReview = drafts.filter((draft) => draft.status === "IN_REVIEW").length;
    if (inReview > 0) {
      steps.push({
        label: `${inReview} ${plural(inReview, "listing is", "listings are")} in review`,
        href: "/broker/agent/my-listings/",
      });
    }
  }

  if (shows("saved-properties") && savedCount === 0) {
    steps.push({ label: "Shortlist a property to compare later", href: "/search/" });
  }

  if (shows("enquiries") && leadCount > 0) {
    steps.push({
      label: `${leadCount} ${plural(leadCount, "enquiry", "enquiries")} waiting for a reply`,
      href: "/broker/leads/",
    });
  }

  /* Verification only matters to someone with property to move, and only when
     they have an organization that is not yet verified. A demand-side persona
     is never shown it, and neither is an account with no organization at all
     -- for them the locked panel already explains onboarding. */
  const side = PERSONA_META[persona]?.side;
  if (side !== "demand" && verificationStatus && !VERIFIED_STATUSES.has(verificationStatus)) {
    steps.push({ label: "Get verified so your listings carry a trust badge", href: "/broker/onboarding/" });
  }

  return steps;
}
