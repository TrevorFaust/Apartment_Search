"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dropdown, OPTION_ROW } from "./dropdown";

type Option = { value: string; label: string };

/** A single-choice dropdown that applies its form as soon as the choice changes. */
export function AutoSubmitSelect({
  label,
  name,
  defaultValue,
  options,
  form,
  inline = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly Option[];
  form?: string;
  inline?: boolean;
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
    inputRef.current?.form?.requestSubmit();
  };

  return (
    <>
      <input ref={inputRef} type="hidden" name={name} value={value} form={form} />
      <Dropdown label={label} summary={current?.label} inline={inline}>
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
                <span className={`size-1.5 shrink-0 rounded-full ${selected ? "bg-accent" : "bg-transparent"}`} />
                {o.label}
              </button>
            );
          })
        }
      </Dropdown>
    </>
  );
}
