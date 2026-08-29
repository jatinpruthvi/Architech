"use client";

/* One keyboard-accessible combobox behind BOTH search surfaces (the hero on `/`
   and the refine box on `/search/`).

   Why this exists: the two pages had grown their own copy of the same control,
   and the copies had drifted — the hero implemented ↑/↓/Enter/Escape, the
   results page shipped a `role="listbox"` whose options were only reachable with
   `onMouseDown`. A listbox is a contract: assistive tech moves a virtual cursor
   inside it and expects arrows to move and Enter to choose. Declaring the role
   without the keys is worse than declaring nothing, because the AT also leaves
   normal browse mode. So the keyboard behaviour is a module now, not a habit. */

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type SuggestOption = {
  kind: string;
  label: string;
  query: string;
  hint?: string;
  href?: string;
};

export type SuggestComboboxConfig = {
  /** The current text in the box, owned by the page (it is also what a page
   *  feeds its own debounced suggestion fetch — the hook deliberately does not
   *  own the value, because that would make the fetch order unsatisfiable). */
  query: string;
  /** Commit a chosen option (or the raw typed text when there is no match). */
  commit: (query: string, href?: string) => void;
  /** The full option list for the current text, in display order. The page owns
   *  both the text and the fetch; this hook owns focus, highlight and keys. */
  suggestions: SuggestOption[];
  /** Close the panel after a commit, so pages can also reset their own focus. */
  close?: () => void;
  /** Show the panel as soon as the input is focused (an empty query still has
   *  recents/popular to offer). Default false: only open once there is a query. */
  openWhenEmpty?: boolean;
};

/** Options rendered before the panel starts scrolling — also how many are
 *  reachable without a scroll, which is why the count is shared, not inline. */
export const VISIBLE_SUGGESTIONS = 12;

export type SuggestCombobox = {
  open: boolean;
  /** Echo of the page's current text, for the footer/legend copy. */
  query: string;
  /** Options to render (the list is capped for the panel, keys cover all). */
  visible: SuggestOption[];
  highlight: number;
  listId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  /** Spread onto the <input>. */
  inputProps: {
    ref: React.RefObject<HTMLInputElement | null>;
    role: "combobox";
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
    "aria-activedescendant": string | undefined;
    "aria-autocomplete": "list";
    autoComplete: "off";
    "aria-haspopup": "listbox";
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  /** Commit the CURRENT text — for a form submit, which must behave exactly like
   *  Enter in the input rather than a second, subtly different path. */
  submit: () => void;
  /** Handlers for one option row (see `SuggestRow`). */
  optionHandlers: {
    onHover: (index: number) => void;
    onSelect: (index: number) => void;
  };
};

export function useSuggestCombobox(config: SuggestComboboxConfig): SuggestCombobox {
  const { query, suggestions, commit, close, openWhenEmpty = false } = config;
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlightState] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const optionCount = suggestions.length;
  /* Clamp rather than trust: a fetch that returns fewer rows between keystrokes
     must not leave the selection pointing past the end (or at a DIFFERENT row). */
  const bounded = optionCount > 0 ? Math.max(0, Math.min(optionCount - 1, highlight)) : -1;

  // A new result set invalidates the previous selection — leaving a stale index
  // pointing at a different locality is how a keyboard user fires the wrong search.
  useEffect(() => {
    setHighlightState(-1);
  }, [suggestions]);

  /* Keep the highlighted row inside the scroll box, but only for keyboard use:
     a mouse hover that yanks the list up/down is its own little motion bug. */
  useEffect(() => {
    const list = listRef.current;
    if (!list || bounded < 0 || !focused) return;
    const node = list.querySelector<HTMLElement>(`[data-suggest-index="${bounded}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [bounded, focused]);

  const closePanel = useCallback(() => {
    setFocused(false);
    setHighlightState(-1);
    close?.();
  }, [close]);

  const commitOption = useCallback(
    (index: number) => {
      const option = suggestions[index];
      if (option) commit(option.query, option.href);
      else commit(query);
      closePanel();
    },
    [closePanel, commit, query, suggestions],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const open = focused && (optionCount > 0 || openWhenEmpty);
      // With no panel there is nothing to navigate; leave the caret alone.
      if (!open) {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(query);
          closePanel();
        }
        return;
      }
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightState(bounded < 0 ? 0 : (bounded + 1) % optionCount);
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightState(bounded <= 0 ? optionCount - 1 : bounded - 1);
          break;
        case "Home":
          if (event.ctrlKey) break; // Ctrl+Home is "go to start of the text"
          event.preventDefault();
          setHighlightState(0);
          break;
        case "End":
          if (event.ctrlKey) break;
          event.preventDefault();
          setHighlightState(optionCount - 1);
          break;
        case "Enter":
          event.preventDefault();
          // No highlight means Enter is a plain search of what was typed, which
          // is the one thing the box must always do.
          commitOption(bounded);
          break;
        case "Escape":
          event.preventDefault();
          closePanel();
          inputRef.current?.focus();
          break;
        case "Tab":
          closePanel();
          break;
      }
    },
    [bounded, closePanel, commit, commitOption, focused, openWhenEmpty, optionCount, query],
  );

  /* Outside click closes; inside interaction must not, or the panel vanishes
     under the pointer between mousedown and click. */
  useEffect(() => {
    if (!focused) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      closePanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [closePanel, focused]);

  const open = focused && (optionCount > 0 || openWhenEmpty);

  return {
    open,
    query,
    visible: suggestions.slice(0, VISIBLE_SUGGESTIONS),
    highlight: bounded,
    listId,
    inputRef,
    listRef,
    inputProps: {
      ref: inputRef,
      role: "combobox",
      // The real open state. The hero previously asserted `focused && (n > 0 || true)`,
      // which is `focused` for every input value — "expanded" while the list was
      // absent from the DOM. Keep this derived from `open`, never from focus alone.
      "aria-expanded": open,
      "aria-controls": open ? listId : undefined,
      "aria-activedescendant": open && bounded >= 0 ? `${listId}-opt-${bounded}` : undefined,
      "aria-autocomplete": "list",
      autoComplete: "off",
      "aria-haspopup": "listbox",
      onFocus: () => setFocused(true),
      onBlur: () => {
        // Blur only closes when the focus left the whole control; `relatedTarget`
        // is the row we just clicked when it is inside the panel.
        window.setTimeout(() => {
          if (!listRef.current?.contains(document.activeElement) && !inputRef.current?.contains(document.activeElement)) {
            closePanel();
          }
        }, 0);
      },
      onKeyDown,
    },
    submit: () => {
      commit(query);
      closePanel();
    },
    optionHandlers: {
      onHover: (index: number) => setHighlightState(index),
      onSelect: (index: number) => commitOption(index),
    },
  };
}
