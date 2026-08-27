"use client";

/* Route-segment error boundary. Lets a user retry a route without a hard
   reload, keeps the editorial shell, and mirrors the site's tone. The stack
   is never shown to users. */
import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report the error to the observability endpoint (redacted, non-blocking).
    try {
      if (typeof window !== "undefined") {
        void fetch("/api/observability/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message || "Route error",
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
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container py-24 text-center md:py-32">
        <p className="kicker text-brick">Something went wrong</p>
        <h1 className="display mx-auto mt-6 max-w-[720px] text-[clamp(40px,6vw,84px)]">This page hit a <em className="text-brick">snag</em>.</h1>
        <p className="mx-auto mt-6 max-w-[460px] text-base leading-8 text-ink/65">
          The page couldn&apos;t be rendered just now. You can retry, or head back to a page that works.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button onClick={reset} className="btn-sweep touch-44 bg-brick px-6 py-4 stamp !text-[12px] font-semibold text-cream">Try again</button>
          <Link href="/" className="touch-44 border border-ink/20 px-6 py-4 stamp !text-[12px] font-semibold text-ink/70 hover:border-brick hover:text-brick">Go home</Link>
        </div>
      </section>
    </div>
  );
}
