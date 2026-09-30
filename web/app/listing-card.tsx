"use client";

import { useState, useTransition } from "react";
import type { ListingRow } from "@/lib/supabase";
import { formatFull, formatMonthDay } from "@/lib/dates";
import { sourceLabel as labelForSource } from "@/lib/sources";
import { toggleFavorite, toggleHidden } from "./actions";

export function ListingCard({
  listing,
  index,
  now,
}: {
  listing: ListingRow;
  index: number;
  now: number;
}) {
  const [pending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);
  const isNew = now - new Date(listing.first_seen_at).getTime() < 24 * 60 * 60 * 1000;
  const isGone = !listing.is_active;
  const sourceLabel = labelForSource(listing.source);
  const listedAt = listing.posted_at ?? listing.first_seen_at;
  const listedHint = listing.posted_at
    ? `Posted on ${sourceLabel}`
    : `Found by Lease Locator (${sourceLabel} doesn't show a post date)`;

  const facts = [
    listing.bedrooms != null
      ? listing.bedrooms === 0
        ? "Studio"
        : `${listing.bedrooms} bd`
      : null,
    listing.bathrooms != null ? `${listing.bathrooms} ba` : null,
    listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean);

  return (
    <article
      className={`rise group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-bg-elevated shadow-soft transition-[transform,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift ${
        isGone ? "opacity-70 hover:opacity-100" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="relative block p-2 pb-0"
        aria-label={`Open ${listing.title} on ${sourceLabel}`}
      >
        <div className="relative h-44 overflow-hidden rounded-[1.1rem] bg-bg-deep">
          {listing.image_url?.startsWith("http") && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              ref={(img) => {
                // Images that failed before hydration never fire onError.
                if (img?.complete && img.currentSrc && img.naturalWidth === 0) {
                  setImageFailed(true);
                }
              }}
            />
          ) : (
            <NoPhoto neighborhood={listing.neighborhood} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/10" />
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 translate-y-1 rounded-full bg-bg-elevated/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent-dim opacity-0 shadow-soft backdrop-blur transition-all duration-300 ease-out-soft group-hover:translate-y-0 group-hover:opacity-100">
            View on {sourceLabel} ↗
          </span>
          {isGone ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/85 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-bg-elevated backdrop-blur">
              No longer listed
            </span>
          ) : (
            isNew && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-bg-elevated shadow-glow">
                New
              </span>
            )
          )}
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-xl font-semibold text-accent">
            {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">
            {sourceLabel}
          </span>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="font-display text-base leading-snug decoration-accent/60 underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {listing.title}
        </a>
        <p className="text-xs text-ink-soft">
          {facts.join(" · ")}
          {facts.length > 0 && listing.neighborhood ? " · " : ""}
          {listing.neighborhood ?? ""}
        </p>
        {listing.address && (
          <p className="text-xs text-ink-faint">{listing.address}</p>
        )}

        <p
          title={`${listedHint}: ${formatFull(listedAt)}`}
          className="mt-1 w-fit cursor-help rounded-full bg-bg-deep/60 px-2.5 py-0.5 text-[11px] text-ink-faint transition-colors hover:bg-accent-wash hover:text-accent-dim"
        >
          Listed <span className="font-medium text-ink-soft">{formatMonthDay(listedAt)}</span>
        </p>

        <div className="mt-auto flex gap-2 pt-4">
          <button
            // Browser autofill extensions inject attributes (fdprocessedid)
            // before hydration; ignore those mismatches.
            suppressHydrationWarning
            disabled={pending}
            aria-pressed={listing.is_favorite}
            onClick={() =>
              startTransition(() =>
                toggleFavorite(listing.id, !listing.is_favorite),
              )
            }
            className={`press flex-1 rounded-full border px-3 py-1.5 text-xs disabled:opacity-50 ${
              listing.is_favorite
                ? "border-accent bg-accent text-bg-elevated shadow-glow hover:border-accent-dim hover:bg-accent-dim"
                : "border-ink/15 bg-bg hover:border-accent/50 hover:bg-accent-wash hover:text-accent-dim"
            }`}
          >
            {pending ? "…" : listing.is_favorite ? "★ Saved" : "☆ Save"}
          </button>
          <button
            suppressHydrationWarning
            disabled={pending}
            onClick={() =>
              startTransition(() => toggleHidden(listing.id, !listing.is_hidden))
            }
            className="press rounded-full border border-ink/15 bg-bg px-4 py-1.5 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated disabled:opacity-50"
          >
            {listing.is_hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}

function NoPhoto({ neighborhood }: { neighborhood: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_90%_at_30%_10%,var(--color-bg-elevated),var(--color-bg-deep))] text-ink-faint transition-colors group-hover:text-accent">
      <svg viewBox="0 0 64 48" aria-hidden className="h-12 w-16 opacity-70">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 44h52" />
          <path d="M12 44V18l14-8 14 8v26" />
          <path d="M40 44V26l12 6v12" />
          <path d="M20 22h4M28 22h4M20 30h4M28 30h4M23 44v-7h6v7" />
        </g>
      </svg>
      <span className="font-display text-sm italic">
        {neighborhood ? `Photos not posted · ${neighborhood}` : "Photos not posted"}
      </span>
    </div>
  );
}
