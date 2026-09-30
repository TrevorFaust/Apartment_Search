"use client";

import { useState } from "react";
import { cleanAmount } from "@/lib/amounts";
import type { Choice } from "@/lib/subscribers";

/**
 * One-tap chips; with `exact`, a number box beside them takes any value
 * (e.g. $3,200) and the chips stay as shortcuts.
 */
export function ChoiceField({
  name,
  choices,
  defaultValue,
  exact,
}: {
  name: string;
  choices: Choice[];
  defaultValue: string;
  exact?: { label: string; prefix?: string; suffix?: string; decimals?: boolean; max?: number };
}) {
  const [value, setValue] = useState(defaultValue);
  const [custom, setCustom] = useState(() =>
    exact && !choices.some((c) => c.value === defaultValue) ? defaultValue : "",
  );
  const usingCustom = custom !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={value} />
      {choices.map((c) => {
        const on = !usingCustom && c.value === value;
        return (
          <button
            key={c.value || "none"}
            type="button"
            aria-pressed={on}
            onClick={() => {
              setValue(c.value);
              setCustom("");
            }}
            className={`press select-none rounded-full border px-4 py-2 text-sm ${
              on
                ? "border-accent bg-accent text-bg-elevated shadow-glow"
                : "border-ink/15 bg-bg text-ink-soft hover:border-accent/50 hover:bg-accent-wash hover:text-accent-dim"
            }`}
          >
            {c.label}
          </button>
        );
      })}
      {exact && (
        <label
          className={`flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm transition-colors ${
            usingCustom ? "border-accent bg-accent-wash text-accent-dim" : "border-ink/15 text-ink-soft"
          }`}
        >
          <span className="text-xs">{exact.label}</span>
          {exact.prefix && <span>{exact.prefix}</span>}
          <input
            suppressHydrationWarning
            type="text"
            inputMode={exact.decimals ? "decimal" : "numeric"}
            autoComplete="off"
            value={custom}
            onChange={(e) => {
              const next = cleanAmount(e.target.value, exact.decimals);
              if (exact.max != null && Number(next) > exact.max) return;
              setCustom(next);
              setValue(next);
            }}
            placeholder="—"
            className="w-20 rounded-full bg-bg-elevated px-2 py-1 text-sm tabular-nums outline-none"
          />
          {exact.suffix && <span className="pr-2 text-xs">{exact.suffix}</span>}
        </label>
      )}
    </div>
  );
}
