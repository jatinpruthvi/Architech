/* ARCHITECH — Amdavad Modern reveal primitive.
   Server content stays visible and crawlable; CSS handles the optional entrance.

   This component is the contract that `theme.css` documents in its Reveal
   block: it emits `architech-reveal` plus `--reveal-delay`, and the CSS owns
   the animation (no-preference guard, 420ms total, `both` fill so a bot, a
   stalled frame, or a paint that never runs cannot be left with invisible
   content). It imports no component library and needs no JavaScript to run,
   so it is a Server Component — the entrance is a stylesheet, not a runtime.

   PERF-R5-006: the previous implementation pulled `motion/react` in here — the
   library's ONLY import in the codebase — which put 116.8 KiB of animation
   runtime on the first load of 16 routes, including /search. That is the route
   whose own design contract says "the library itself blew the search first-load
   budget" (design-token-discipline.test.ts) and which ships the reveal via
   ResultsPage. Restoring the stylesheet implementation drops the library
   entirely while keeping the entrance.

   Delay is capped at 320ms, as the theme.css block states: choreography over
   content that is already on screen is a tax, not a feature. */
import type { CSSProperties, ReactNode } from "react";

type RevealProps = { children: ReactNode; className?: string; delay?: number };

/** The class theme.css animates, and the cap it reads the delay from. */
export const REVEAL_CLASS = "architech-reveal";
export const REVEAL_MAX_DELAY_MS = 320;

/** Clamp a caller's stagger to the documented range. Non-finite input (a
 *  caller computing a delay from data) falls back to no delay rather than
 *  emitting `NaNms`, which would void the whole animation declaration. */
export function revealDelayMs(delay: number): number {
  if (!Number.isFinite(delay)) return 0;
  return Math.min(Math.max(delay, 0), REVEAL_MAX_DELAY_MS);
}

export default function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  return (
    <div
      className={className ? `${REVEAL_CLASS} ${className}` : REVEAL_CLASS}
      style={{ "--reveal-delay": `${revealDelayMs(delay)}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
