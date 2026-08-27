"use client";

/* Root error boundary for uncaught errors outside a route segment. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, background: "#f4eee2", color: "#1b1612" }}>
        <div style={{ display: "grid", minHeight: "100svh", placeItems: "center", padding: "24px", textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: "clamp(40px,7vw,84px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: 0 }}>Something went wrong.</h1>
            <p style={{ maxWidth: 460, margin: "20px auto 0", fontSize: 15, lineHeight: 1.7, opacity: 0.65 }}>
              The app hit an unexpected error. Try again in a moment.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 28, padding: "16px 26px", background: "#a8432a", color: "#f4eee2", border: "none", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", touchAction: "manipulation" }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
