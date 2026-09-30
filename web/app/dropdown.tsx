"use client";

import { useEffect, useId, useRef, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  sublabel?: string;
  /** Matching listings, shown after the label. */
  count?: number;
};

/** Button + floating panel shared by every filter dropdown. */
export function Dropdown({
  label,
  summary,
  inline = false,
  onClear,
  children,
}: {
  label: string;
  summary: React.ReactNode;
  inline?: boolean;
  /** Shows a small × beside the label while the filter has a value. */
  onClear?: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative flex ${inline ? "items-center gap-2" : "flex-col gap-1"}`}
    >
      <FieldLabel id={labelId} label={label} onClear={onClear} />
      <button
        type="button"
        suppressHydrationWarning
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((v) => !v)}
        className={`field-control group flex min-w-0 items-center justify-between gap-2 text-left ${
          open ? "border-accent! shadow-[0_0_0_3px_var(--color-accent-wash)]" : ""
        }`}
      >
        <span className="truncate">{summary}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={labelId}
          className={`rise absolute top-full z-30 mt-1.5 max-h-80 w-max min-w-full max-w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden border border-ink/20 bg-bg-elevated p-1.5 shadow-lift [animation-duration:160ms] ${
            inline ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Filter label with an optional clear (×) button on the right. */
export function FieldLabel({
  id,
  htmlFor,
  label,
  onClear,
}: {
  id?: string;
  htmlFor?: string;
  label: string;
  onClear?: () => void;
}) {
  const Text = htmlFor ? "label" : "span";
  return (
    <span className="flex min-h-5 items-center justify-between gap-2">
      <Text id={id} htmlFor={htmlFor} className="text-xs uppercase tracking-[0.18em] text-brass">
        {label}
      </Text>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          title={`Clear ${label}`}
          className="press flex size-5 items-center justify-center bg-ink/10 text-xs leading-none text-ink-soft hover:bg-ink hover:text-metal"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function OptionText({ option }: { option: DropdownOption }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">
        {option.label}
        {option.count != null && (
          <span className="ml-1 text-ink-faint tabular-nums">({option.count})</span>
        )}
      </span>
      {option.sublabel && (
        <span className="text-[11px] leading-tight text-ink-faint">{option.sublabel}</span>
      )}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden
      className={`size-3 shrink-0 text-ink-faint transition-[transform,color] duration-300 ease-out-soft group-hover:text-accent ${
        open ? "rotate-180 text-accent" : ""
      }`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const OPTION_ROW =
  "flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-wash hover:text-ink";

/** Submits the form that contains `el` after React has flushed pending state. */
export function submitClosestForm(el: Element | null) {
  const form = el instanceof HTMLInputElement && el.form ? el.form : el?.closest("form");
  form?.requestSubmit();
}
