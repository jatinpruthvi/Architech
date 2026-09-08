import type { ReactNode } from "react";

type StatusBadgeProps = { children: ReactNode; tone?: "trust" | "ember" | "neutral" | "danger" };

export default function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone} stamp !text-[10px] font-semibold`}>{children}</span>;
}
