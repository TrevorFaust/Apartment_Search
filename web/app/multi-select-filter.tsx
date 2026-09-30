"use client";

import { useEffect, useMemo, useState } from "react";
import { Dropdown, OPTION_ROW } from "./dropdown";

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
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected));

  const resolved = useMemo(
    () =>
      options
        .map((option) => resolveOption(option))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [options],
  );

  const labelByValue = useMemo(
    () => new Map(resolved.map((option) => [option.value, option.label])),
    [resolved],
  );

  useEffect(() => {
    setChecked(new Set(selected));
  }, [selected]);

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
    <>
      {[...checked].map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Dropdown label={label} summary={summary}>
        {() =>
          resolved.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-faint">No options</p>
          ) : (
            resolved.map((option) => {
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
                    className={`flex size-4 shrink-0 items-center justify-center rounded-md border text-[10px] transition-colors ${
                      on
                        ? "border-accent bg-accent text-bg-elevated"
                        : "border-ink/25 bg-bg-elevated"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )
        }
      </Dropdown>
    </>
  );
}
