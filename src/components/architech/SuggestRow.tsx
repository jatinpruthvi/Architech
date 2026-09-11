"use client";

/* One option row of the search combobox, shared by the hero and the results
   page so the two surfaces cannot drift into two different controls again.

   Deliberate details:
   - `role="option"` on a <button>: the listbox contract needs an option, but the
     element must still be a real button for click/Enter semantics and focus.
   - `onMouseDown` with preventDefault, not `onClick`: mousedown would otherwise
     move focus out of the input, and a combobox that blinks its caret away on
     every pick loses the keyboard user's place.
   - `data-suggest-index` is the hook's handle for "scroll this row into view"
     while arrowing — no ids, no querySelector on markup someone may restyle. */

import { useEffect, useRef } from "react";
import { ArrowUpRight, House, MapPin, Search, SlidersHorizontal } from "lucide-react";
import type { SuggestOption } from "./useSuggestCombobox";

type SuggestRowProps = {
  option: SuggestOption;
  index: number;
  id: string;
  highlighted: boolean;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
};

const ICONS = {
  structured: SlidersHorizontal,
  listing: House,
  query: Search,
  popular: Search,
  city: MapPin,
  pincode: MapPin,
  locality: MapPin,
} as const;

export default function SuggestRow({ option, index, id, highlighted, onHover, onSelect }: SuggestRowProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const Icon = ICONS[option.kind as keyof typeof ICONS] ?? Search;

  // Belt to the hook's scroll-into-view: if this row is the highlighted one and
  // something else moved focus (a click after an arrow), keep it visible.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <button
      ref={ref}
      type="button"
      id={id}
      data-suggest-index={index}
      role="option"
      aria-selected={highlighted}
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect(index);
      }}
      onMouseEnter={() => onHover(index)}
      className={`group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[15px] leading-6 transition-colors duration-150 ${
        highlighted ? "border-brick bg-sand text-ink" : "border-transparent text-ink hover:bg-sand/60"
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
          highlighted ? "border-brick bg-paper text-brick" : "border-ink/15 ink-2"
        }`}
        aria-hidden="true"
      >
        <Icon size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{option.label}</span>
        {option.hint ? <span className="mt-0.5 block truncate stamp ink-3">{option.hint}</span> : null}
      </span>
      {option.href ? (
        <ArrowUpRight size={13} className="mt-1.5 shrink-0 ink-3" aria-hidden="true" />
      ) : null}
    </button>
  );
}
