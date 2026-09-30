"use client";

import { useState, useTransition } from "react";
import type { ListingRow } from "@/lib/supabase";
import { formatFull, formatMonthDay } from "@/lib/dates";
import { sourceLabel as labelForSource } from "@/lib/sources";
import { toggleFavorite, toggleHidden } from "./actions";
import { MapThumb } from "./map-thumb";

export function ListingCard({
  listing,
  index,
  now,
  favorite,
  hidden,
}: {
  listing: ListingRow;
  index: number;
  now: number;
  favorite: boolean;
  hidden: boolean;
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
      className={`rise group relative z-0 flex flex-col bg-bg-elevated transition-[transform,box-shadow] duration-300 ease-out-soft hover:z-10 hover:-translate-y-1 hover:shadow-lift ${
        isGone ? "opacity-70 hover:opacity-100" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <Corners />
      <a
        href={listing.url}
        target="_blank"
        rel="noreferrer"
        className="relative block"
        aria-label={`Open ${listing.title} on ${sourceLabel}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-bg-deep">
          {listing.image_url?.startsWith("http") && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]"
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
          ) : listing.latitude != null && listing.longitude != null ? (
            <MapThumb
              lat={listing.latitude}
              lng={listing.longitude}
              label={listing.neighborhood ? `No photos · ${listing.neighborhood}` : "No photos posted"}
            />
          ) : (
            <NoPhoto neighborhood={listing.neighborhood} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/15" />
          <span className="pointer-events-none absolute bottom-3 right-3 translate-y-1 bg-ink/90 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-metal opacity-0 transition-all duration-300 ease-out-soft group-hover:translate-y-0 group-hover:opacity-100">
            View on {sourceLabel}
          </span>
          {isGone ? (
            <span className="absolute left-3 top-3 bg-ink px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-bg-elevated">
              Taken down
            </span>
          ) : (
            isNew && (
              <span className="absolute left-3 top-3 bg-metal px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink">
                New
              </span>
            )
          )}
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-4">
        <div className="flex items-end justify-between gap-3 border-b border-metal/70 pb-2">
          <span className="font-display text-[2rem] leading-none font-medium tracking-tight text-ink tabular-nums">
            {listing.price != null ? `$${listing.price.toLocaleString()}` : "—"}
          </span>
          <span className="mb-1 text-[11px] uppercase tracking-[0.2em] text-brass">
            {sourceLabel}
          </span>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="font-display text-lg leading-snug font-medium decoration-brass underline-offset-4 transition-colors hover:text-brass hover:underline"
        >
          {listing.title}
        </a>
        {(facts.length > 0 || listing.neighborhood) && (
          <div className="flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span
                key={fact}
                className="border border-ink/15 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft"
              >
                {fact}
              </span>
            ))}
            {listing.neighborhood && (
              <span className="border border-brass/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-brass">
                {listing.neighborhood}
              </span>
            )}
          </div>
        )}
        {listing.address && (
          <p className="text-xs leading-relaxed text-ink-faint">{listing.address}</p>
        )}

        <p
          title={`${listedHint}: ${formatFull(listedAt)}`}
          className="w-fit cursor-help text-[11px] uppercase tracking-[0.16em] text-ink-faint"
        >
          Listed <span className="text-ink">{formatMonthDay(listedAt)}</span>
        </p>

        <div className="mt-auto flex gap-2 border-t border-ink/10 pt-3">
          <button
            // Browser autofill extensions inject attributes (fdprocessedid)
            // before hydration; ignore those mismatches.
            suppressHydrationWarning
            disabled={pending}
            aria-pressed={favorite}
            onClick={() =>
              startTransition(() =>
                toggleFavorite(listing.id, !favorite),
              )
            }
            className={`press inline-flex min-h-11 flex-1 items-center justify-center gap-2 border px-3 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50 ${
              favorite
                ? "border-ink bg-ink text-metal hover:bg-brass hover:text-bg-elevated"
                : "border-ink/20 bg-bg-elevated text-ink hover:border-ink hover:bg-ink hover:text-metal"
            }`}
          >
            <Star filled={favorite} />
            {pending ? "Saving" : favorite ? "Saved" : "Save"}
          </button>
          <button
            suppressHydrationWarning
            disabled={pending}
            onClick={() =>
              startTransition(() => toggleHidden(listing.id, !hidden))
            }
            className="press inline-flex min-h-11 items-center border border-ink/20 px-4 text-[11px] uppercase tracking-[0.16em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated disabled:opacity-50"
          >
            {hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Corners() {
  const arm =
    "pointer-events-none absolute z-10 h-3.5 w-3.5 border-metal opacity-0 transition-opacity duration-300 group-hover:opacity-100";
  return (
    <>
      <span aria-hidden className={`${arm} top-2 left-2 border-t border-l`} />
      <span aria-hidden className={`${arm} top-2 right-2 border-t border-r`} />
      <span aria-hidden className={`${arm} bottom-2 left-2 border-b border-l`} />
      <span aria-hidden className={`${arm} right-2 bottom-2 border-r border-b`} />
    </>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
      <path
        d="M8 1.2 9.7 6h4.9L11.1 8.9 12.7 14 8 11.1 3.3 14l1.6-5.1L1.4 6h4.9Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function NoPhoto({ neighborhood }: { neighborhood: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,var(--color-bg-elevated)_25%,transparent_25%,transparent_50%,var(--color-bg-elevated)_50%,var(--color-bg-elevated)_75%,transparent_75%)] bg-[length:18px_18px] bg-bg-deep text-ink-faint transition-colors group-hover:text-brass">
      <svg viewBox="0 0 64 48" aria-hidden className="h-12 w-16 opacity-70">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 44h52" />
          <path d="M12 44V18l14-8 14 8v26" />
          <path d="M40 44V26l12 6v12" />
          <path d="M20 22h4M28 22h4M20 30h4M28 30h4M23 44v-7h6v7" />
        </g>
      </svg>
      <span className="bg-bg-elevated/90 px-2 py-1 font-display text-sm italic">
        {neighborhood ? `Photos not posted · ${neighborhood}` : "Photos not posted"}
      </span>
    </div>
  );
}
