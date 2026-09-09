import type { Metadata } from "next";
import BrokerLeadDetail from "@/pages/BrokerLeadDetail";
import RequireSession from "@/components/architech/RequireSession";

/* Lead detail — the mobile calling surface.

   Same guard posture as the inbox list (`app/broker/leads/page.tsx`):
   `lead.inbox.read` for navigation, and the authoritative check stays in
   `authorizeRequest()` inside the API. RequireSession is a navigation guard,
   not an authorisation boundary — see its own header comment.

   Revealing the number is NOT covered by this route's permission. It is a
   separate gated action (Phase 3: POST /api/broker/leads/[id]/reveal) that
   additionally requires plan entitlement, `humanFirstTouch` consent, no
   suppression, calling hours, and an attempt budget, and writes an AuditEvent.
   A broker who can open this page can still be refused the dial. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enquiry · Architech broker",
  description: "A single buyer enquiry, its consent trail, and the call actions available to the assigned partner.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireSession permission="lead.inbox.read" requireOrganization>
      <BrokerLeadDetail leadId={decodeURIComponent(id)} />
    </RequireSession>
  );
}
