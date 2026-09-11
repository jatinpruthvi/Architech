"use client";

/* Always-mounted launcher for the global command palette.

   This file is deliberately tiny: it is part of first-load JS on every page,
   while the palette itself (cmdk and friends) is dynamic-imported only on
   first open. Anything added here ships everywhere — keep it cheap. */

import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLang } from "@/contexts/LangContext";

const CommandPalette = dynamic(() => import("@/components/architech/CommandPalette"), { ssr: false });

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function CommandPaletteLauncher({ onDark = false }: { onDark?: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  /* Global open gestures. Mod+K is the cross-platform convention; "/" is the
     docs-site habit. Neither fires while the person is typing in a field. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setArmed(true);
        setOpen((current) => !current);
        return;
      }
      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        setArmed(true);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isApple = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
  const hint = isApple ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setArmed(true);
          setOpen(true);
        }}
        aria-label={t.palette.open}
        title={t.palette.open}
        className={`hidden items-center gap-2 rounded-xl border px-3 py-2.5 stamp font-medium transition-colors md:inline-flex ${
          onDark
            ? "border-cream/25 text-cream hover:border-ember hover:text-ember"
            : "border-ink/15 ink-2 hover:border-brick hover:text-brick"
        }`}
      >
        <Search size={13} strokeWidth={1.9} aria-hidden="true" />
        <kbd
          aria-hidden="true"
          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${onDark ? "border-cream/25 text-cream" : "border-ink/15 ink-3"}`}
        >
          {hint}
        </kbd>
      </button>
      {armed ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
