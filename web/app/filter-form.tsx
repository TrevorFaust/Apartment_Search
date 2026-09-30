"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * GET form that drops empty fields from the URL and shows a progress bar
 * while the filtered page loads.
 */
export function FilterForm({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      id={id}
      aria-busy={pending}
      className={`group ${className ?? ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const qs = new URLSearchParams();
        for (const [key, value] of new FormData(e.currentTarget)) {
          if (typeof value !== "string" || value === "") continue;
          if (key === "sort" && value === "newest") continue;
          qs.append(key, value);
        }
        const query = qs.toString();
        startTransition(() => router.push(query ? `/?${query}` : "/"));
      }}
    >
      {pending && <ProgressBar />}
      {children}
    </form>
  );
}

export function ProgressBar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 origin-left animate-[progress_1.6s_var(--ease-out-soft)_infinite] bg-accent"
    />
  );
}
