import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "green" | "amber" | "rose" | "violet" | "slate";

const toneBg: Record<Tone, string> = {
  blue: "#e3f0ff",
  green: "#e0fbf0",
  amber: "#fff2d4",
  rose: "#ffe2e9",
  violet: "#efe6ff",
  slate: "#e8eef5",
};
const toneFg: Record<Tone, string> = {
  blue: "#1d5fc2",
  green: "#0e8a65",
  amber: "#b27b0b",
  rose: "#c12e4c",
  violet: "#5e35c9",
  slate: "#39495b",
};

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
    <article className={`tp-card ${big ? "md:col-span-2" : ""}`}>
      <div className="flex items-center justify-between">
        <span
          className="tp-chip"
          style={{ background: toneBg[tone], color: toneFg[tone] }}
        >
          <Icon size={14} className="inline -mt-0.5 mr-1" />
          {label}
        </span>
      </div>
      <p className="tp-kpi-value mt-4" style={{ color: toneFg[tone] }}>
        {typeof value === "number"
          ? `# ${value.toLocaleString("en-IN")}~`
          : value}
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
    <div
      className="rounded-xl border p-3 text-center"
      style={{
        borderColor: toneBg[tone],
        background: "#fafcff",
      }}
    >
      <p className="text-[.68rem] font-semibold uppercase" style={{ color: toneFg[tone] }}>
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold" style={{ color: toneFg[tone] }}>
        {typeof value === "number" ? `# ${value.toLocaleString("en-IN")}~` : value}
      </p>
    </div>
  );
}
