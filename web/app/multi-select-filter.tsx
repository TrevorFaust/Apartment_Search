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
}: {
  name: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  emptyLabel?: string;
  /** When cleared with ×, also submit the form (browse filters). */
  clearSubmits?: boolean;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(selected));
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

  const summary =
    checked.size === 0
      ? emptyLabel
      : checked.size === 1
        ? (labelByValue.get([...checked][0]!) ?? [...checked][0])
        : `${checked.size} selected`;

  return (
    <>
      <span ref={anchorRef} hidden />
      {[...checked].map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Dropdown
        label={label}
        summary={summary}
        onClear={checked.size > 0 ? clear : undefined}
      >
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
          )
        }
      </Dropdown>
    </>
  );
}
