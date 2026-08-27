/* ARCHITECH — Amdavad Modern reveal primitive.
   Server content stays visible and crawlable; CSS handles the optional entrance. */
import type { ReactNode } from "react";

type RevealProps = { children: ReactNode; className?: string; delay?: number };

export default function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const safeDelay = Math.min(Math.max(delay, 0), 320);
  return (
    <div className={`${className} architech-reveal architech-reveal-entered`} style={{ "--reveal-delay": `${safeDelay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
