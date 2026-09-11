import type { ReactNode } from "react";

type StatusBadgeProps = { children: ReactNode; tone?: "trust" | "ember" | "neutral" | "danger" };

export default function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  /* `.stamp` owns the type size (12px, per-theme colour) — the 10px override
     this used to carry is exactly the micro-text debt the design-token ratchet
     retires, and 12px keeps the badge legible at a glance. */
  return <span className={`status-badge status-badge-${tone} stamp font-semibold`}>{children}</span>;
}
