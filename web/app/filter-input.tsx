"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cleanAmount } from "@/lib/amounts";
import { FieldLabel, submitClosestForm } from "./dropdown";

/** Browse-filter amount box (typed only, never negative) with a × that clears it and re-applies filters. */
export function FilterInput({
  label,
  name,
  defaultValue,
  decimals = false,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  decimals?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const inputId = useId();

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel
        htmlFor={inputId}
        label={label}
        onClear={
          value !== ""
            ? () => {
                flushSync(() => setValue(""));
                submitClosestForm(inputRef.current);
              }
            : undefined
        }
      />
      <input
        ref={inputRef}
        id={inputId}
        suppressHydrationWarning
        name={name}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(cleanAmount(e.target.value, decimals))}
        className="field-control"
      />
      {hint && <span className="pl-1 text-[10px] text-ink-faint">{hint}</span>}
    </div>
  );
}
