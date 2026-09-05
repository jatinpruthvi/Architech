"use client";

/* Global command palette (⌘K / Ctrl+K / "/").

   Lazy-loaded: the always-present CommandPaletteLauncher holds open state and
   pulls this chunk in only on first use, so cmdk never lands in first-load JS.

   Ordering contract: suggestion order comes from the server ranker
   (/api/search/suggest) and is passed through untouched with
   shouldFilter={false} — a palette that re-ranks server results would present
   two different orderings for the same query on one site.

   Colour contract: semantic ink-2/ink-3 tokens only (per-theme AA values) —
   alpha labels (text-ink/NN) measure differently across themes and the
   design-token ratchet refuses them in new files. */

import { Command } from "cmdk";
import { ArrowUpRight, Clock, House, Loader2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogDescription, DialogTitle, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useLang } from "@/contexts/LangContext";
import { buildPaletteGroups, searchUrlForQuery, type PaletteEntry } from "@/lib/search/palette-actions";
import { readRecentSearches, rememberRecentSearch } from "@/lib/search/recent";
import { useSearchSuggestions } from "./useSearchSuggestions";

const KIND_ICONS = {
  structured: SlidersHorizontal,
  listing: House,
  locality: MapPin,
  city: MapPin,
  pincode: MapPin,
  popular: Search,
  query: Search,
  action: ArrowUpRight,
} as const;

function PaletteItem({ entry, onChoose }: { entry: PaletteEntry; onChoose: (entry: PaletteEntry) => void }) {
  const Icon = KIND_ICONS[entry.kind] ?? Search;
  return (
    <Command.Item
      value={entry.id}
      onSelect={() => onChoose(entry)}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink outline-none transition-colors data-[selected=true]:bg-brick/10"
    >
      <Icon size={15} strokeWidth={1.8} className="ink-3 shrink-0 group-data-[selected=true]:text-brick" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.hint ? <span className="ink-3 shrink-0 text-xs">{entry.hint}</span> : null}
    </Command.Item>
  );
}

const GROUP_HEADING =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:ink-3";

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useLang();
  const copy = t.palette;
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const { suggestions, loading } = useSearchSuggestions(trimmed);
  const recents = useMemo(() => (open && trimmed.length === 0 ? readRecentSearches() : []), [open, trimmed]);

  const groups = useMemo(
    () =>
      buildPaletteGroups({
        query,
        recents,
        suggestions,
        quickActionLabels: copy.actions,
        searchForPrefix: copy.searchFor,
      }),
    [query, recents, suggestions, copy],
  );

  /* Reset the draft when the palette closes so a later open starts clean. */
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const choose = (entry: PaletteEntry) => {
    onOpenChange(false);
    if (entry.href) {
      router.push(entry.href);
      return;
    }
    const q = entry.query?.trim();
    if (!q) return;
    rememberRecentSearch(q);
    router.push(searchUrlForQuery(q));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-label={copy.label}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(92vw,38rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-ink/10 bg-paper text-ink shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onOpenAutoFocus={(event) => {
            /* Keep focus landing in the input, matching every palette the
               person has used elsewhere. */
            event.preventDefault();
            const root = event.currentTarget as HTMLElement;
            root.querySelector("input")?.focus();
          }}
        >
          <DialogTitle className="sr-only">{copy.label}</DialogTitle>
          <DialogDescription className="sr-only">{copy.placeholder}</DialogDescription>
          <Command shouldFilter={false} label={copy.label}>
            <div className="flex items-center gap-2 border-b border-ink/10 px-4">
              <Search size={16} className="ink-3 shrink-0" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={copy.placeholder}
                aria-label={copy.placeholder}
                className="w-full bg-transparent py-4 text-[15px] text-ink outline-none placeholder:text-current placeholder:opacity-50"
              />
              {loading ? <Loader2 size={15} className="ink-3 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={copy.close}
                className="ink-3 grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <Command.List className="max-h-[52vh] overflow-y-auto p-2">
              {groups.recents.length === 0 && groups.suggestions.length === 0 && groups.actions.length === 0 && !groups.runQuery ? (
                <p className="ink-2 px-3 py-6 text-center text-sm">{copy.empty}</p>
              ) : null}

              {groups.recents.length > 0 ? (
                <Command.Group heading={copy.recentGroup} className={GROUP_HEADING}>
                  {groups.recents.map((entry) => (
                    <PaletteItem key={entry.id} entry={entry} onChoose={choose} />
                  ))}
                </Command.Group>
              ) : null}

              {groups.suggestions.length > 0 ? (
                <Command.Group heading={copy.suggestionsGroup} className={GROUP_HEADING}>
                  {groups.suggestions.map((entry) => (
                    <PaletteItem key={entry.id} entry={entry} onChoose={choose} />
                  ))}
                </Command.Group>
              ) : null}

              {groups.actions.length > 0 ? (
                <Command.Group heading={copy.actionsGroup} className={GROUP_HEADING}>
                  {groups.actions.map((entry) => (
                    <PaletteItem key={entry.id} entry={entry} onChoose={choose} />
                  ))}
                </Command.Group>
              ) : null}

              {groups.runQuery ? (
                <Command.Group>
                  <Command.Item
                    value={groups.runQuery.id}
                    onSelect={() => choose(groups.runQuery as PaletteEntry)}
                    className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink outline-none transition-colors data-[selected=true]:bg-brick/10"
                  >
                    <Clock size={15} strokeWidth={1.8} className="ink-3 shrink-0 group-data-[selected=true]:text-brick" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{groups.runQuery.label}</span>
                  </Command.Item>
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
