"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Button + floating panel shared by every filter dropdown. */
export function Dropdown({
  label,
  summary,
  inline = false,
  children,
}: {
  label: string;
  summary: React.ReactNode;
  inline?: boolean;
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
      <span id={labelId} className="pl-1 text-[10px] uppercase tracking-widest text-ink-soft">
        {label}
      </span>
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
          className={`rise absolute top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-line/80 bg-bg-elevated p-1.5 shadow-lift [animation-duration:160ms] ${
            inline ? "right-0 w-max min-w-full" : "left-0 right-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
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
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent-wash hover:text-accent-dim";
