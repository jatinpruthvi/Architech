"use client";

/* Route-segment error boundary for the techno broker workspace.
 *
 * The public-site boundary (src/app/error.tsx) renders the marketing chrome,
 * which does not exist inside this workspace. Without a segment boundary here,
 * any panel whose data fetch dies (Prisma unreachable, a bad row, a renames)
 * takes the whole streamed page down mid-flight: the 200 shell flushes, the
 * browser gets a broken client render, and the dev overlay reports an uncaught
 * error. With it, the failed panel is replaced in place, the sidebar/topbar
 * shell stays, and retry works without a reload. The stack is never shown. */
import { useEffect } from "react";
import Link from "next/link";

export default function TechnoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    /* Report to the observability endpoint (redacted, non-blocking) — the same
       contract as the root boundary. */
    try {
      if (typeof window !== "undefined") {
        void fetch("/api/observability/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message || "Techno route error",
            severity: "error",
            route: window.location.pathname,
            href: window.location.href,
            buildTag: "phase-1",
          }),
        });
      }
    } catch {
      /* never let reporting break the boundary */
    }
  }, [error.message]);

  return (
    <div className="border border-[var(--tp-border)] bg-white p-8 md:p-12">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--tp-accent)]">Data unavailable</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-[var(--tp-ink)]">This panel could not load.</h2>
      <p className="mt-3 max-w-[520px] text-sm leading-6 text-[var(--tp-muted)]">
        The listing database behind this panel is not reachable right now. Retry, or head back to the dashboard — the
        rest of the workspace keeps working.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={reset} className="tp-btn tp-btn-primary min-h-11 justify-center">
          Try again
        </button>
        <Link href="/broker/" className="tp-btn tp-btn-ghost min-h-11 justify-center">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
