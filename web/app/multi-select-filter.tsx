"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Dropdown,
  OPTION_ROW,
  OptionText,
  submitClosestForm,
  type DropdownOption,
} from "./dropdown";

export type FilterOption = string | DropdownOption;

function resolveOption(option: FilterOption): DropdownOption {
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
  clearSubmits = false,
  searchable = false,
}: {
  name: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  emptyLabel?: string;
  /** When cleared with ×, also submit the form (browse filters). */
  clearSubmits?: boolean;
  /** Type-to-filter box in the panel, plus removable chips under the field. */
  searchable?: boolean;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected));
  const [query, setQuery] = useState("");
  const anchorRef = useRef<HTMLSpanElement>(null);

  const resolved = useMemo(
    () =>
      options
        .map((option) => resolveOption(option))
        .sort(
          (a, b) =>
            a.label.localeCompare(b.label) ||
            (a.sublabel ?? "").localeCompare(b.sublabel ?? ""),
        ),
    [options],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.sublabel ?? "").toLowerCase().includes(q),
    );
  }, [resolved, query]);

  const labelByValue = useMemo(
    () => new Map(resolved.map((option) => [option.value, option.label])),
    [resolved],
  );

  const selectedKey = selected.join("\u0000");
  useEffect(() => {
    setChecked(new Set(selectedKey ? selectedKey.split("\u0000") : []));
  }, [selectedKey]);

  const toggle = (value: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const clear = () => {
    flushSync(() => setChecked(new Set()));
    if (clearSubmits) submitClosestForm(anchorRef.current);
  };

  const remove = (value: string) => {
    flushSync(() =>
      setChecked((prev) => {
        const next = new Set(prev);
        next.delete(value);
        return next;
      }),
    );
    if (clearSubmits) submitClosestForm(anchorRef.current);
  };

  const summary =
    checked.size === 0
      ? emptyLabel
      : checked.size === 1
        ? (labelByValue.get([...checked][0]!) ?? [...checked][0])
        : `${checked.size} selected`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span ref={anchorRef} hidden />
      {[...checked].map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Dropdown
        label={label}
        summary={summary}
        onClear={checked.size > 0 ? clear : undefined}
      >
        {() => (
          <>
            {searchable && (
              <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 border-b border-ink/10 bg-bg-elevated p-1.5">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter would submit the whole filter form; pick the top match instead.
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (visible[0]) toggle(visible[0].value);
                  }}
                  placeholder={`Search ${label.toLowerCase()}`}
                  aria-label={`Search ${label.toLowerCase()}`}
                  autoComplete="off"
                  className="field-control w-full"
                />
              </div>
            )}
            {visible.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-faint">
                {query ? `No match for “${query}”` : "No options"}
              </p>
            ) : (
              visible.map((option) => {
                const on = checked.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(option.value)}
                    className={`${OPTION_ROW} ${on ? "font-medium text-accent-dim" : ""}`}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center border text-[10px] transition-colors ${
                        on
                          ? "border-accent bg-accent text-bg-elevated"
                          : "border-ink/25 bg-bg-elevated"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <OptionText option={option} />
                  </button>
                );
              })
            )}
          </>
        )}
      </Dropdown>
      {searchable && checked.size > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Selected ${label.toLowerCase()}`}>
          {[...checked].map((value) => {
            const text = labelByValue.get(value) ?? value;
            return (
              <li
                key={value}
                className="flex items-center border border-brass/50 bg-bg-elevated text-xs text-ink"
              >
                <span className="py-1 pl-2 pr-1">{text}</span>
                <button
                  type="button"
                  onClick={() => remove(value)}
                  aria-label={`Remove ${text}`}
                  title={`Remove ${text}`}
                  className="press flex size-6 items-center justify-center text-ink-soft hover:bg-ink hover:text-metal"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
