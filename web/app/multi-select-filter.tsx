"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type FilterOption = string | { value: string; label: string };

function resolveOption(option: FilterOption): { value: string; label: string } {
  return typeof option === "string"
    ? { value: option, label: option }
    : option;
}

export function MultiSelectFilter({
  name,
  label,
  options,
  selected,
  emptyLabel = "Any",
}: {
  name: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected));
  const rootRef = useRef<HTMLDivElement>(null);

  const resolved = useMemo(
    () => options.map((option) => resolveOption(option)),
    [options],
  );

  const labelByValue = useMemo(
    () => new Map(resolved.map((option) => [option.value, option.label])),
    [resolved],
  );

  useEffect(() => {
    setChecked(new Set(selected));
  }, [selected]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggle = (value: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const summary =
    checked.size === 0
      ? emptyLabel
      : checked.size === 1
        ? (labelByValue.get([...checked][0]!) ?? [...checked][0])
        : `${checked.size} selected`;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`field-control group flex items-center justify-between text-left ${
          open ? "border-accent" : ""
        }`}
      >
        <span className="truncate">{summary}</span>
        <span
          className={`ml-2 text-ink-faint transition-transform duration-200 group-hover:text-accent ${
            open ? "rotate-180 text-accent" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {checked.size > 0 &&
        [...checked].map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))}

      {open && (
        <div className="rise absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border border-line bg-bg-elevated shadow-[3px_3px_0_0_var(--color-accent)] [animation-duration:150ms]">
          {resolved.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-faint">No options</p>
          ) : (
            resolved.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 border-b border-line/40 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-accent-wash hover:text-accent-dim ${
                  checked.has(option.value) ? "bg-accent-wash/60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked.has(option.value)}
                  onChange={() => toggle(option.value)}
                  className="accent-accent"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
