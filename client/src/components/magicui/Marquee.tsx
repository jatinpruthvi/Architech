/* Magic-UI-style marquee: infinite horizontal scroll, either direction, pause on hover. */
import type { ReactNode } from "react";

export default function Marquee({ children, reverse = false, speed = 36, className = "" }: { children: ReactNode; reverse?: boolean; speed?: number; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`} style={{ animationDuration: `${speed}s` }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
