"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/admin/icons";
import { JUMP_TARGETS } from "@/components/admin/nav";

interface Item {
  key: string;
  label: string;
  href: string;
  hint: string;
}

export function itemsFor(query: string): Item[] {
  const text = query.trim();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const pages = JUMP_TARGETS.filter((target) => {
    const haystack = `${target.label} ${target.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  })
    .slice(0, text ? 6 : 12)
    .map((target) => ({ key: target.href, label: target.label, href: target.href, hint: "Go to" }));
  if (!text) return pages;
  const search = { key: "search", label: `Find “${text}” in visits and people`, href: `/admin/search?q=${encodeURIComponent(text)}`, hint: "Search" };
  // Matching pages first; when nothing matches, Enter searches.
  return [...pages, search];
}

const noSubscription = () => () => {};

/** "Search or jump to…": Ctrl+K or ⌘K anywhere, or / when not typing. */
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(() => itemsFor(query), [query]);
  // The server can't know the keyboard, so it renders "Ctrl K" and Macs switch after hydrating.
  const mac = useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setQuery("");
    setActive(0);
    dialog.showModal();
    inputRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  function go(item: Item | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const onClose = () => triggerRef.current?.focus();
    dialog?.addEventListener("close", onClose);

    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || dialogRef.current?.open) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      dialog?.removeEventListener("close", onClose);
    };
  }, []);

  function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[active]);
    }
  }

  const activeId = items[active] ? `${listId}-option-${active}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K /"
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 text-sm text-ink-2 transition-colors hover:bg-fill sm:min-w-56 sm:px-3"
      >
        <SearchIcon size={16} />
        <span className="sr-only sm:not-sr-only">Search or jump to…</span>
        <kbd className="ml-auto hidden rounded border border-hairline bg-canvas px-1.5 font-sans text-xs text-muted sm:inline">
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop clicks; Escape closes from the keyboard */}
      <dialog
        ref={dialogRef}
        aria-label="Search or jump to"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-hairline bg-surface p-0 text-ink shadow-raised backdrop:bg-black/30"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search or jump to"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="A page, a patient’s name, a reference or an email"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-7 items-center rounded border border-hairline px-1.5 text-xs text-muted hover:bg-fill"
          >
            Esc<span className="sr-only">, close</span>
          </button>
        </div>
        {/* A combobox popup (WAI-ARIA APG): the input keeps focus and handles the keys. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div id={listId} role="listbox" aria-label="Results" className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {items.map((item, index) => (
            // The combobox input keeps focus and handles the keys, so options aren't focusable.
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={item.key}
              id={`${listId}-option-${index}`}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="option"
              aria-selected={index === active}
              onMouseMove={() => setActive(index)}
              onClick={() => go(item)}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-sm ${
                index === active ? "bg-accent-soft text-ink" : "text-ink"
              }`}
            >
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 text-xs text-muted">{item.hint}</span>
            </div>
          ))}
        </div>
        <p className="border-t border-hairline px-4 py-2 text-xs text-muted">
          <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to choose, <kbd className="font-sans">Enter</kbd> to open
        </p>
      </dialog>
    </>
  );
}
