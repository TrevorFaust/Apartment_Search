"use client";

import { useLinkStatus } from "next/link";

/** Drop inside a <Link>: pulses the label while that link's page is loading. */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className={`inline-flex items-center gap-1.5 ${pending ? "animate-pulse" : ""}`}>
      {children}
      {pending && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
    </span>
  );
}
