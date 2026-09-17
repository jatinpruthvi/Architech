"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Global keyboard shortcuts for the Techno broker workspace:
 *   c     → jump to Call queue
 *   /     → focus the nearest search input on the current page
 *   j / k → move highlight up/down in a table row (visual ring, enter to open)
 *   w     → WhatsApp the currently highlighted owner/broker
 *   s     → Share the currently highlighted listing (copies link to clipboard)
 *   n     → open/close the note editor on the highlighted row
 *   l     → toggle Shortlist (bookmark) on the highlighted row
 *   ?     → open How it works (bonus)
 *
 * Shortcuts are disabled when the user is typing in an input, textarea, select
 * or content-editable region so they don't steal keystrokes from forms.
 */
export default function TechnoKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function moveRow(delta: 1 | -1) {
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>(".tp-table tbody tr"),
      );
      if (rows.length === 0) return;
      const current = rows.findIndex((r) => r.dataset.hotkey === "current");
      let next = 0;
      if (current === -1) {
        next = delta === 1 ? 0 : rows.length - 1;
      } else {
        rows[current].dataset.hotkey = "";
        rows[current].style.outline = "";
        next = Math.max(0, Math.min(rows.length - 1, current + delta));
      }
      rows[next].dataset.hotkey = "current";
      rows[next].style.outline = "2px solid var(--tp-accent)";
      rows[next].style.outlineOffset = "-2px";
      rows[next].scrollIntoView({ block: "nearest" });
    }

    function currentRow() {
      return document.querySelector<HTMLElement>(
        '.tp-table tbody tr[data-hotkey="current"]',
      );
    }

    function openHighlightedRow() {
      const r = currentRow();
      if (!r) return;
      const target =
        r.querySelector<HTMLAnchorElement>("a[href]") ||
        r.querySelector<HTMLButtonElement>("button");
      target?.click();
    }

    function clickInRow(selectors: string[]) {
      const r = currentRow();
      if (!r) return false;
      for (const sel of selectors) {
        const el = r.querySelector<HTMLElement>(sel);
        if (el) {
          el.click();
          return true;
        }
      }
      return false;
    }

    function focusSearch() {
      const input = document.querySelector<HTMLInputElement>(
        '.tp-search input, input[type="search"], input[role="searchbox"], header input',
      );
      if (input) {
        input.focus();
        input.select();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      // Ignore chords
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "c":
          if (pathname !== "/broker/call-queue") {
            e.preventDefault();
            router.push("/broker/call-queue");
          }
          break;
        case "/":
          e.preventDefault();
          focusSearch();
          break;
        case "j":
          e.preventDefault();
          moveRow(1);
          break;
        case "k":
          e.preventDefault();
          moveRow(-1);
          break;
        case "Enter": {
          const cur = document.querySelector('.tp-table tbody tr[data-hotkey="current"]');
          if (cur) {
            e.preventDefault();
            openHighlightedRow();
          }
          break;
        }
        case "w":
          e.preventDefault();
          clickInRow([
            "[data-tp-action=\"whatsapp\"]",
            "a[href*='wa.me']",
            "button[aria-label*='hatsapp' i]",
          ]);
          break;
        case "s":
          e.preventDefault();
          clickInRow([
            "[data-tp-action=\"share\"]",
            "button[aria-label*='hare' i]",
          ]);
          break;
        case "n":
          e.preventDefault();
          clickInRow([
            "[data-tp-action=\"note\"]",
            "button[aria-label*='ote' i]",
          ]);
          break;
        case "l":
          e.preventDefault();
          clickInRow([
            "[data-tp-action='shortlist'], [data-tp-action='bookmark']",
            "button[aria-label*='ookmark' i], button[aria-label*='hortlist' i]",
          ]);
          break;
        case "Escape": {
          const cur = currentRow();
          if (cur) {
            cur.dataset.hotkey = "";
            cur.style.outline = "";
          }
          break;
        }
        case "?":
          router.push("/guide");
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return null;
}
