/* Server Component (PERF-R5-002): WhatsAppFab — a static anchor.
   Every interactive control inside is its own client component, so this file
   needs no client boundary of its own — one here re-ships this markup (and its
   icon imports) in the route's first-load JS for no behaviour. No hooks, event
   handlers, browser APIs or time-dependent render output (verified; pinned by
   server-client-boundary.test.ts). Re-measure before adding `"use client"` back. */
import { MessageCircle } from "lucide-react";

export default function WhatsAppFab() {
  return (
    <a
      href="https://wa.me/919876543210?text=Hi%2C%20I%20need%20help%20with%20my%20Architech%20workspace"
      target="_blank"
      rel="noreferrer"
      className="tp-fab-whatsapp"
      aria-label="Chat on WhatsApp"
      title="Chat with support"
    >
      <MessageCircle size={26} />
    </a>
  );
}
