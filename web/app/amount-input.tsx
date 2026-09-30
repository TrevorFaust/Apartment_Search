"use client";

import { useState } from "react";
import { cleanAmount } from "@/lib/amounts";

/** Typed-only number box: no spinner arrows, no negatives. */
export function AmountInput({
  name,
  defaultValue,
  decimals = false,
  className,
}: {
  name: string;
  defaultValue: string;
  decimals?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      suppressHydrationWarning
      name={name}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      value={value}
      onChange={(e) => setValue(cleanAmount(e.target.value, decimals))}
      className={className}
    />
  );
}
