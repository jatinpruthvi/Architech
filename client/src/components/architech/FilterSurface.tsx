"use client";
/* ARCHITECH — Facet surface (filter rebuild).
 *
 * One panel, two hosts: a sticky rail at ≥1024px and the existing mobile drawer.
 * It is NOT a mobile fallback — the ~even desktop/mobile split means both
 * render the same groups, counts and outcome footer, so no feature is gated
 * behind a breakpoint (the pre-rebuild map toggle was, `lg:hidden`, which made
 * "map" a no-op on desktop).
 *
 * The panel is stateless: `state` and `onChange` belong to the page so the URL
 * stays the single source of truth (back/forward and shared links keep working).
 */
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
 formatIndianRupees,
 formatSqft,
 type FacetCounts,
 type FacetGroup,
 type FacetState,
} from "@/lib/search/facets";
import type { Lang } from "@/lib/i18n";

type Props = {
 groups: FacetGroup[];
 state: FacetState;
 counts: FacetCounts;
 lang: Lang;
 onChange: (next: FacetState) => void;
 onClear: () => void;
 /** The panel writes straight to the URL, so "Done" only dismisses it. */
 onClose?: () => void;
 /** Budget presets are scale-specific: a ₹20k/month preset is nonsense in a
 * buy search, and a "Under ₹75 Cr" one is nonsense in a rent search. */
 intent: "buy" | "rent";
 /**
 * `rail` fills its sticky parent and scrolls internally; `sheet` sizes to its
 * content so vaul's own drag/max-height behaviour stays intact. A single
 * `h-full flex-col` in both hosts makes an empty sheet 80vh of whitespace.
 */
 layout?: "rail" | "sheet";
 /** Label for the confirm control; the caller appends the live result count. */
 labels: {
 title: string;
 hint: string;
 done: string;
 noChange: string;
 noChangeHint: string;
 localityNone: string;
 budget: string;
 budgetFrom: string;
 budgetTo: string;
 histogramHint: string;
 verifiedToggle: string;
 verifiedHidden: (n: number) => string;
 clearGroup: string;
 };
 resultCount: number;
};

const label = (group: { label: string; labelHi: string }, lang: Lang) => (lang === "hi" ? group.labelHi : group.label);

export default function FilterPanel({ groups, state, counts, lang, onChange, onClear, onClose, labels, resultCount, intent, layout = "sheet" }: Props) {
 const activeCount = Object.values(state.multi).reduce((sum, values) => sum + (values?.length ?? 0), 0) + Object.keys(state.ranges).length;

 const setGroupValues = (groupId: string, values: string[]) => {
 const next: FacetState = { multi: { ...state.multi }, ranges: state.ranges };
 if (values.length) next.multi[groupId] = values;
 else delete next.multi[groupId];
 onChange(next);
 };

 const toggleValue = (groupId: string, valueId: string, kind: FacetGroup["kind"]) => {
 const current = state.multi[groupId] ?? [];
 // A toggle group is binary; a multi group ORs its values.
 if (kind === "toggle") {
 setGroupValues(groupId, current.includes(valueId) ? [] : [valueId]);
 return;
 }
 setGroupValues(groupId, current.includes(valueId) ? current.filter((id) => id !== valueId) : [...current, valueId]);
 };

 return (
 <div className={layout === "rail" ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
 <div className="flex items-center justify-between gap-3 border-b border-ink/12 pb-3">
 <p className="facet-group-title">{labels.title}</p>
 {activeCount > 0 && (
 <button type="button" onClick={onClear} className="facet-link">
 {labels.clearGroup}
 </button>
 )}
 </div>
 <p className="facet-hint pt-3">{labels.hint}</p>

 <div className={layout === "rail" ? "min-h-0 flex-1 overflow-y-auto" : ""}>
 {groups.map((group) => {
 const counted = counts[group.id];
 if (!counted) return null;
 return (
 <section key={group.id} className="facet-group" aria-labelledby={`facet-${group.id}-title`}>
 <div className="flex items-baseline justify-between gap-3">
 <h3 id={`facet-${group.id}-title`} className="facet-group-title">
 {label(group, lang)}
 </h3>
 {group.kind === "range" && state.ranges[group.id] && (
 <button type="button" onClick={() => { const ranges = { ...state.ranges }; delete ranges[group.id]; onChange({ multi: state.multi, ranges }); }} className="stamp min-h-[36px] px-1 facet-link">
 {labels.clearGroup}
 </button>
 )}
 </div>

 {group.kind === "range" ? (
 <RangeControl
 group={group}
 range={state.ranges[group.id]}
 histogram={counted.histogram}
 total={counted.total}
 intent={intent}
 labels={labels}
 onChange={(next) => {
 const ranges = { ...state.ranges };
 if (next) ranges[group.id] = next;
 else delete ranges[group.id];
 onChange({ multi: state.multi, ranges });
 }}
 />
 ) : (
 ( <> {counted.options.length === 0 && <p className="facet-hint mt-3">{labels.localityNone}</p>}
 <ul className="mt-3 space-y-2" role="list" aria-label={label(group, lang)}>
 {counted.options.map((option) => {
 const dead = option.count === 0 && !option.selected;
 return (
 <li key={option.id} role="listitem">
 <button
 type="button"
 /* `role="checkbox"` + aria-checked, not aria-pressed: a filter row is a
    checked state on the INVENTORY, not a toggle on the button itself. With
    aria-pressed a screen reader says "2 BHK, toggle button, not pressed" and
    never mentions the count that is the entire point of the row. */
 role="checkbox"
 aria-checked={option.selected}
 aria-label={`${option.label}, ${dead ? labels.noChange : `${option.count} homes`}`}
 // Disabled but VISIBLE: removing an option teaches people
 // the filter is broken; a dashed (0) tells them the
 // inventory is what is scarce.
 aria-disabled={dead || undefined}
 title={dead ? labels.noChangeHint : undefined}
 onClick={() => !dead && toggleValue(group.id, option.id, group.kind)}
 className="facet-option"
 >
 <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${option.selected ? "border-brick clay-fill bg-brick text-cream" : "border-ink/30"}`} aria-hidden="true">
 {option.selected && <Check size={11} strokeWidth={3} />}
 </span>
 <span className="min-w-0 flex-1 truncate">{option.label}</span>
 <span className="facet-count">{dead ? labels.noChange : option.count}</span>
 </button>
 </li>
 );
 })}
 </ul>
 </>
 ) )}

 {/* The verified toggle states what it HIDES, which is worth more
 trust than the badge on the results themselves. */}
 {group.id === "trust" && counted.total > (counted.options[0]?.count ?? 0) && (
 <p className="facet-hint mt-2">{labels.verifiedHidden(counted.total - (counted.options[0]?.count ?? 0))}</p>
 )}
 </section>
 );
 })}
 </div>

 <div className="mt-4 border-t border-ink/12 pt-4">
 {/* The confirm control names the OUTCOME, not the action: the count is
 computed from the same facet state that produces the results, so it
 cannot disagree with what appears on apply. Applying is live (each
 option writes through to the URL), so this only dismisses. */}
 <button
 type="button"
 onClick={() => onClose?.()}
 className="clay-fill btn-solid touch-44 w-full bg-brick py-3 stamp font-semibold text-cream"
 >
 {labels.done} · {resultCount === 1 ? 1 : resultCount}
 </button>
 </div>
 </div>
 );
}

/* ---------- Range control ----------
 Two numeric fields over a live histogram. Deliberately not a dual-thumb
 slider: a slider cannot express "₹60 Cr+" without lying, needs 44px+ touch
 targets per thumb, and its precision is worse than typing a number. The
 histogram supplies the affordance a slider is usually bought for. */
function RangeControl({
 group,
 range,
 histogram,
 total,
 intent,
 labels,
 onChange,
}: {
 group: FacetGroup;
 range?: { from: number; to: number };
 histogram?: FacetCounts[string]["histogram"];
 total: number;
 intent: "buy" | "rent";
 labels: Props["labels"];
 onChange: (next: { from: number; to: number } | undefined) => void;
}) {
 const min = group.range?.min ?? 0;
 const max = group.range?.max ?? 0;
 const format = group.range?.unit === "sqft" ? formatSqft : formatIndianRupees;
 const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);

 const shown = useMemo(() => {
 if (draft) return draft;
 if (range) return { from: String(range.from), to: String(range.to) };
 // Open-ended by default: an input pre-filled with the control ceiling
 // reads like a limit on the market, which is a false claim.
 return { from: "", to: "" };
 }, [draft, range]);

 const commit = (patch: Partial<{ from: string; to: string }>) => {
 const next = { ...shown, ...patch };
 setDraft(next);
 const from = next.from.trim() === "" ? min : Number.parseInt(next.from.replace(/\D/g, ""), 10);
 const to = next.to.trim() === "" ? max : Number.parseInt(next.to.replace(/\D/g, ""), 10);
 if (!Number.isFinite(from) || !Number.isFinite(to)) return;
 if (from <= min && to >= max) onChange(undefined);
 else onChange({ from: Math.min(from, to), to: Math.max(from, to) });
 };

 return (
 <div className="mt-3">
 {histogram && histogram.buckets.length > 1 && (
 <div className="mb-3">
 {/* role="img" + a text summary: a bar chart of counts is decoration to
 a screen reader unless it is described, so it is described. */}
 <div
 className="facet-histogram"
 role="img"
 aria-label={`${labels.budget}: ${total} listing${total === 1 ? "" : "s"} between ${format(histogram.floor)} and ${format(histogram.ceil)}+`}
 data-testid="facet-histogram"
 >
 {histogram.buckets.map((bucket) => {
 const inRange = !range || (bucket.to > range.from && bucket.from < range.to);
 return (
 <span
 key={bucket.from}
 data-inrange={inRange ? "true" : "false"}
 title={`${format(bucket.from)} – ${format(bucket.to)} · ${bucket.count}`}
 className="facet-histogram-bar"
 style={{ height: `${Math.max(4, Math.round((bucket.count / Math.max(1, histogram.max)) * 100))}%` }}
 />
 );
 })}
 </div>
 <div className="mt-1 flex justify-between">
 <span className="stamp ink-3">{format(histogram.floor)}</span>
 <span className="stamp ink-3">{format(histogram.ceil)}+</span>
 </div>
 <p className="facet-hint mt-1">{labels.histogramHint}</p>
 </div>
 )}

 <div className="grid grid-cols-2 gap-2">
 <label className="block">
 <span className="stamp ink-2">{labels.budgetFrom}</span>
 <input
 type="text"
 inputMode="numeric"
 value={shown.from}
 onChange={(event) => commit({ from: event.target.value })}
 placeholder={format(min)}
 className="facet-field mt-1"
 aria-label={`${labels.budget} ${labels.budgetFrom}`}
 />
 </label>
 <label className="block">
 <span className="stamp ink-2">{labels.budgetTo}</span>
 <input
 type="text"
 inputMode="numeric"
 value={shown.to}
 onChange={(event) => commit({ to: event.target.value })}
 placeholder={format(histogram?.ceil ?? max)}
 className="facet-field mt-1"
 aria-label={`${labels.budget} ${labels.budgetTo}`}
 />
 </label>
 </div>

 <div className="mt-2 flex flex-wrap gap-1.5">
 {quickBudgets(group.range?.unit, intent).map((preset) => (
 <button
 key={preset.label}
 type="button"
 onClick={() => {
 setDraft(null);
 onChange(preset.range);
 }}
 aria-pressed={range?.from === preset.range?.from && range?.to === preset.range?.to}
 className="facet-control"
 >
 {preset.label}
 </button>
 ))}
 </div>
 </div>
 );
}

/** Typable shortcuts for the budgets people actually ask for. Values are
 * control-domain-relative, not data-relative, so they never invent a market. */
function quickBudgets(unit: "inr" | "sqft" | undefined, intent: "buy" | "rent"): Array<{ label: string; range?: { from: number; to: number } }> {
 if (unit === "sqft") {
 return [
 { label: "1,000+", range: { from: 1000, to: 6000 } },
 { label: "2,000+", range: { from: 2000, to: 6000 } },
 { label: "3,000+", range: { from: 3000, to: 6000 } },
 ];
 }
 if (intent === "rent") {
 return [
 { label: "≤ ₹15k", range: { from: 5_000, to: 15_000 } },
 { label: "₹15–30k", range: { from: 15_000, to: 30_000 } },
 { label: "₹30–60k", range: { from: 30_000, to: 60_000 } },
 { label: "Reset", range: undefined },
 ];
 }
 return [
 { label: "Under ₹75 L", range: { from: 1_000_000, to: 7_500_000 } },
 { label: "₹75 L – ₹1.5 Cr", range: { from: 7_500_000, to: 15_000_000 } },
 { label: "₹1.5 – ₹3 Cr", range: { from: 15_000_000, to: 30_000_000 } },
 { label: "Reset", range: undefined },
 ];
}

/** Applied constraints, each removable, rendered above the results. */
export function AppliedFacetRow({
 applied,
 onRemove,
 onClear,
 clearLabel,
 relaxations,
 relaxTitle,
 relaxAction,
 onApplyRelaxation,
}: {
 applied: Array<{ groupId: string; valueId: string; label: string; groupLabel: string }>;
 onRemove: (groupId: string, valueId: string) => void;
 onClear: () => void;
 clearLabel: string;
 relaxations?: Array<{ groupId: string; groupLabel: string; label: string; gain: number }>;
 relaxTitle?: string;
 relaxAction?: (label: string, gain: number) => string;
 onApplyRelaxation?: (groupId: string) => void;
}) {
 const [showAll, setShowAll] = useState(false);
 if (!applied.length) return null;
 const visible = showAll ? applied : applied.slice(0, 6);
 return (
 <div className="flex flex-wrap items-center gap-2">
 {visible.map((entry) => (
 <span key={`${entry.groupId}:${entry.valueId}`} className="facet-applied">
 {entry.label}
 <button
 type="button"
 onClick={() => onRemove(entry.groupId, entry.valueId)}
 aria-label={`Remove ${entry.groupLabel} filter ${entry.label}`}
 className="clay-fill touch-44 -mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brick"
 >
 <X size={13} aria-hidden="true" />
 </button>
 </span>
 ))}
 {applied.length > 6 && (
 <button type="button" onClick={() => setShowAll((prev) => !prev)} className="touch-44 stamp px-2 font-semibold" style={{ color: "var(--facet-link)" }}>
 {showAll ? "−" : `+${applied.length - 6}`}
 </button>
 )}
 <button type="button" onClick={onClear} className="touch-44 stamp px-2 font-semibold ink-2 underline underline-offset-4">
 {clearLabel}
 </button>
 {/* The relaxation lives with the chips it modifies, so "loosen one thing"
 is one tap from the thing that is too tight — not on a hidden panel. */}
 {relaxations && relaxations.length > 0 && relaxTitle && relaxAction && (
 <div className="flex w-full flex-wrap items-center gap-2 border-t border-ink/12 pt-2" data-testid="relax-row">
 <span className="stamp text-trust">{relaxTitle}</span>
 {relaxations.map((relaxation) => (
 <button
 key={relaxation.groupId}
 type="button"
 onClick={() => onApplyRelaxation?.(relaxation.groupId)}
 className="facet-control"
 >
 {relaxAction(relaxation.groupLabel, relaxation.gain)}
 </button>
 ))}
 </div>
 )}
 </div>
 );
}
