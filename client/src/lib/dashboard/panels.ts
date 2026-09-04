/* Which panels each persona's dashboard is composed of.
 *
 * Kept as data rather than JSX branching so the composition is testable and
 * so a persona cannot accidentally be given a panel whose data it has no
 * right to. `PANEL_META` names the permission a panel needs, and the renderer
 * refuses to draw a panel whose permission the session lacks — belt and
 * braces on top of the server-side check the panel's own API performs.
 *
 * The five personas are genuinely different jobs, and the panel sets say so:
 *
 *   Buyer / Tenant are DEMAND. They need to see what they asked for, what
 *   they saved, and what came back. Their dashboard is a search-and-shortlist
 *   surface. Tenant differs from buyer only in vocabulary and in the fact
 *   that a tenancy has an end date worth surfacing.
 *
 *   Owner / Builder are SUPPLY. They need to see the property they have, its
 *   readiness for publication, and who has enquired. An owner has one or two
 *   properties; a builder has inventory across projects, so the same
 *   underlying data is presented as a portfolio rather than as a single
 *   property card.
 *
 *   Broker is BOTH, plus the partner channel, which is the only panel set
 *   that requires real authority.
 */
import type { DashboardPersona } from "./persona";

export const DASHBOARD_PANELS = [
  "requirements",
  "saved-properties",
  "saved-searches",
  "my-listings",
  "enquiries",
  "channel",
  "verification",
  "next-steps",
] as const;

export type DashboardPanel = (typeof DASHBOARD_PANELS)[number];

export type PanelMeta = {
  panel: DashboardPanel;
  title: string;
  /** Explains what the panel is for when it has no rows yet. */
  emptyTitle: string;
  emptyBody: string;
  /** Where the panel's primary action leads. */
  href: string;
  actionLabel: string;
  /** Permission required to render. `null` = any signed-in session. */
  permission: string | null;
};

export const PANEL_META: Record<DashboardPanel, PanelMeta> = {
  requirements: {
    panel: "requirements",
    title: "Your requirements",
    emptyTitle: "No requirements yet",
    emptyBody: "Tell us what you are looking for and we will match it against new inventory as it arrives.",
    href: "/requirements/",
    actionLabel: "Add a requirement",
    permission: null,
  },
  "saved-properties": {
    panel: "saved-properties",
    title: "Shortlist",
    emptyTitle: "Nothing shortlisted yet",
    emptyBody: "Save a property while you browse and it will be waiting here when you come back.",
    href: "/search/",
    actionLabel: "Browse properties",
    permission: null,
  },
  "saved-searches": {
    panel: "saved-searches",
    title: "Saved searches",
    emptyTitle: "No saved searches",
    emptyBody: "Save a search to be told when something matching it is listed.",
    href: "/search/",
    actionLabel: "Start a search",
    permission: "saved-search.read",
  },
  "my-listings": {
    panel: "my-listings",
    title: "Your properties",
    emptyTitle: "No properties listed yet",
    emptyBody: "List a property to start receiving enquiries. Drafts stay private until they pass review.",
    href: "/broker/listings/new/",
    actionLabel: "List a property",
    permission: null,
  },
  enquiries: {
    panel: "enquiries",
    title: "Enquiries",
    emptyTitle: "No enquiries yet",
    emptyBody: "When someone asks about your property the conversation appears here. Contact details stay masked until consent is recorded.",
    href: "/broker/leads/",
    actionLabel: "Open lead inbox",
    permission: "lead.inbox.read",
  },
  channel: {
    panel: "channel",
    title: "Partner channel",
    emptyTitle: "No channel activity",
    emptyBody: "Post a requirement or an available property to the verified partner network and matches will surface here.",
    href: "/broker/channel/",
    actionLabel: "Open channel",
    permission: "channel.read",
  },
  verification: {
    panel: "verification",
    title: "Verification",
    emptyTitle: "Not yet verified",
    emptyBody: "Verified partners can trade on the channel and carry a visible trust badge on every listing.",
    href: "/broker/onboarding/",
    actionLabel: "Start verification",
    permission: null,
  },
  "next-steps": {
    panel: "next-steps",
    title: "Next steps",
    emptyTitle: "You are all caught up",
    emptyBody: "Nothing is waiting on you right now.",
    href: "/search/",
    actionLabel: "Keep looking",
    permission: null,
  },
};

/* Panel order per persona. Order is the message: the first panel is what that
   person came to the dashboard to see. A buyer opens on what they asked for,
   an owner on the property they are trying to let or sell. */
const PERSONA_PANELS: Record<DashboardPersona, DashboardPanel[]> = {
  buyer: ["next-steps", "requirements", "saved-properties", "saved-searches"],
  tenant: ["next-steps", "requirements", "saved-properties", "saved-searches"],
  owner: ["next-steps", "my-listings", "enquiries", "requirements", "verification"],
  builder: ["next-steps", "my-listings", "enquiries", "requirements", "verification"],
  broker: ["next-steps", "my-listings", "enquiries", "channel", "requirements", "saved-searches"],
};

export function panelsForPersona(persona: DashboardPersona): DashboardPanel[] {
  return [...(PERSONA_PANELS[persona] ?? PERSONA_PANELS.buyer)];
}

/** Panels this persona shows AND this session is permitted to load. */
export function visiblePanels(persona: DashboardPersona, permissions: string[]): DashboardPanel[] {
  const granted = new Set(permissions);
  return panelsForPersona(persona).filter((panel) => {
    const required = PANEL_META[panel].permission;
    return required === null || granted.has(required);
  });
}
