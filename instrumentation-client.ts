// Client-side Sentry is intentionally not imported by default to preserve Phase 1
// first-load budgets. Enable by importing `sentry.client.config.ts` from this
// file once NEXT_PUBLIC_SENTRY_DSN and a client sampling policy are approved.

/* The sandbox preview harness instruments DOM elements with `bis_size`
   geometry attributes before React hydrates, so the dev overlay reports a
   hydration-mismatch "Issue" for every measured element even though the app
   markup matches. This file runs before hydration and outside the React tree
   (no inline-script dev warnings), so sweep the attribute once and keep
   stripping it as it arrives — hydration then sees a clean tree.
   Dev-only: the overlay and the harness do not exist in production, and
   stripping there would only fight instrumentation that causes no harm. */
if (process.env.NODE_ENV === "development" && typeof MutationObserver !== "undefined") {
  const ATTR = "bis_size";

  const stripIn = (root: ParentNode) => {
    const nodes = (root as Element).querySelectorAll?.(`[${ATTR}]`);
    if (nodes) for (let i = 0; i < nodes.length; i++) nodes[i].removeAttribute(ATTR);
    const self = root as Element;
    if (self.removeAttribute && self.hasAttribute(ATTR)) self.removeAttribute(ATTR);
  };

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes") {
        const t = m.target as Element;
        if (t && t.removeAttribute) t.removeAttribute(ATTR);
      } else if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) stripIn(n as Element);
        }
      }
    }
  });

  stripIn(document.documentElement);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ATTR],
    childList: true,
    subtree: true,
  });
}
