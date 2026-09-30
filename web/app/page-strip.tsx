"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LinkPending } from "./link-pending";

/**
 * Every page number in one horizontally scrollable strip: drag, swipe, or
 * mouse-wheel through it; the current page starts centered.
 */
export function PageStrip({
  current,
  total,
  query,
}: {
  current: number;
  total: number;
  /** Current filter query string without `page`. */
  query: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 });

  const href = (p: number) => {
    const qs = new URLSearchParams(query);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  };

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>("[aria-current='page']");
    if (!strip || !active) return;
    strip.scrollTo({
      left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2,
      behavior: "smooth",
    });
  }, [current]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = strip.scrollWidth - strip.clientWidth;
      const atEdge =
        (e.deltaY < 0 && strip.scrollLeft <= 0) ||
        (e.deltaY > 0 && strip.scrollLeft >= max - 1);
      if (atEdge) return;
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    };
    strip.addEventListener("wheel", onWheel, { passive: false });
    return () => strip.removeEventListener("wheel", onWheel);
  }, []);

  const nudge = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({
      left: dir * stripRef.current.clientWidth * 0.7,
      behavior: "smooth",
    });

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-col items-center gap-3">
      <div className="flex w-full max-w-2xl items-center gap-2">
        <StepLink href={current > 1 ? href(current - 1) : null} label="Previous page">
          ←
        </StepLink>

        <div className="relative min-w-0 flex-1 rounded-full border border-line/70 bg-bg-elevated p-1 shadow-soft">
          <button
            type="button"
            aria-label="Scroll page numbers left"
            onClick={() => nudge(-1)}
            className="absolute inset-y-1 left-1 z-10 hidden w-8 items-center justify-center rounded-full bg-bg-elevated/90 text-ink-faint transition-colors hover:text-accent sm:flex"
          >
            ‹
          </button>
          <div
            ref={stripRef}
            className="flex cursor-grab gap-1 overflow-x-auto px-1 [mask-image:linear-gradient(90deg,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] active:cursor-grabbing sm:px-9 [&::-webkit-scrollbar]:hidden"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse") return;
              drag.current = {
                active: true,
                moved: false,
                x: e.clientX,
                left: e.currentTarget.scrollLeft,
              };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d.active) return;
              const dx = e.clientX - d.x;
              if (Math.abs(dx) > 4) d.moved = true;
              if (d.moved) e.currentTarget.scrollLeft = d.left - dx;
            }}
            onPointerUp={() => {
              drag.current.active = false;
            }}
            onPointerLeave={() => {
              drag.current.active = false;
            }}
            onClickCapture={(e) => {
              if (drag.current.moved) {
                e.preventDefault();
                e.stopPropagation();
                drag.current.moved = false;
              }
            }}
          >
            {Array.from({ length: total }, (_, i) => i + 1).map((p) => {
              const isCurrent = p === current;
              return (
                <Link
                  key={p}
                  href={href(p)}
                  draggable={false}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex h-9 min-w-9 shrink-0 select-none items-center justify-center rounded-full px-2.5 text-sm tabular-nums transition-[background-color,color,transform,box-shadow] duration-200 ease-out-soft ${
                    isCurrent
                      ? "bg-accent font-semibold text-bg-elevated shadow-glow"
                      : "text-ink-soft hover:-translate-y-0.5 hover:bg-accent-wash hover:text-accent-dim"
                  }`}
                >
                  <LinkPending>{p}</LinkPending>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Scroll page numbers right"
            onClick={() => nudge(1)}
            className="absolute inset-y-1 right-1 z-10 hidden w-8 items-center justify-center rounded-full bg-bg-elevated/90 text-ink-faint transition-colors hover:text-accent sm:flex"
          >
            ›
          </button>
        </div>

        <StepLink href={current < total ? href(current + 1) : null} label="Next page">
          →
        </StepLink>
      </div>
      <p className="text-xs text-ink-faint">
        Page {current} of {total} · drag or scroll the numbers to jump ahead
      </p>
    </nav>
  );
}

function StepLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const base =
    "flex size-11 shrink-0 items-center justify-center rounded-full border text-base";
  if (!href) {
    return (
      <span aria-disabled className={`${base} cursor-not-allowed border-ink/10 text-ink-faint/60`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${base} press border-line/70 bg-bg-elevated shadow-soft hover:border-accent/50 hover:bg-accent-wash hover:text-accent-dim hover:shadow-lift`}
    >
      <LinkPending>{children}</LinkPending>
    </Link>
  );
}
