"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dropdown, OPTION_ROW, submitClosestForm } from "./dropdown";

type Option = { value: string; label: string };

/** A single-choice dropdown that applies its form as soon as the choice changes. */
export function AutoSubmitSelect({
  label,
  name,
  defaultValue,
  options,
  form,
  inline = false,
  clearable = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly Option[];
  form?: string;
  inline?: boolean;
  /** Offer a × that resets to the "" option. */
  clearable?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const current = options.find((o) => o.value === value) ?? options[0];

  const choose = (next: string) => {
    if (next === value) return;
    flushSync(() => setValue(next));
    submitClosestForm(inputRef.current);
  };

  return (
    <>
      <input ref={inputRef} type="hidden" name={name} value={value} form={form} />
      <Dropdown
        label={label}
        summary={current?.label}
        inline={inline}
        onClear={clearable && value !== "" ? () => choose("") : undefined}
      >
        {(close) =>
          options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  close();
                  choose(o.value);
                }}
                className={`${OPTION_ROW} ${selected ? "font-medium text-accent-dim" : ""}`}
              >
                <span className={`size-1.5 shrink-0 rotate-45 ${selected ? "bg-brass" : "bg-transparent"}`} />
                <span className="break-words">{o.label}</span>
              </button>
            );
          })
        }
      </Dropdown>
    </>
  );
}
