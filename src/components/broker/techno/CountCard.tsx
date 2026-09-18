import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "green" | "amber" | "rose" | "violet" | "slate";

/* Tones resolve in the token layer (.tp-chip-*, .tp-tone-*, .tp-tint-* in
   src/theme.css) so the KPIs track the theme instead of carrying raw hexes. */

export function CountCard({
  icon: Icon,
  value,
  label,
  subtitle,
  tone,
  big = false,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  subtitle: string;
  tone: Tone;
  big?: boolean;
}) {
  return (
    <article className={`tp-card ${big ? "col-span-2 md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between">
        <span className={`tp-chip tp-chip-${tone}`}>
          <Icon size={14} className="inline -mt-0.5 mr-1" />
          {label}
        </span>
      </div>
      <p className={`tp-kpi-value mt-4 tp-tone-${tone}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      <p className="tp-kpi-sub">{subtitle}</p>
    </article>
  );
}

export function MiniCountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: Tone;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center tp-tint-${tone}`}>
      <p className="text-[.68rem] font-semibold uppercase">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
    </div>
  );
}
