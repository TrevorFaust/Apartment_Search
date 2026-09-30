"use client";

import { useState, useTransition } from "react";
import type { ListingRow } from "@/lib/supabase";
import { formatFull, formatMonthDay } from "@/lib/dates";
import { sourceLabel as labelForSource } from "@/lib/sources";
import type { MapPoint } from "@/lib/area-maps";
import type { Pursuit } from "@/lib/marks";
import { toggleFavorite, toggleHidden, updatePursuit } from "./actions";
import { MapThumb } from "./map-thumb";

export function ListingCard({
  listing,
  index,
  now,
  favorite,
  hidden,
  pursuit,
  mapPoint,
}: {
  listing: ListingRow;
  index: number;
  now: number;
  favorite: boolean;
  hidden: boolean;
  pursuit: Pursuit | null;
  mapPoint: MapPoint | null;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Pursuit | null>(pursuit);
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
          ) : mapPoint ? (
            <MapThumb
              lat={mapPoint.lat}
              lng={mapPoint.lng}
              zoom={mapPoint.approximate ? 13 : 15}
              label={mapPoint.label}
            />
          ) : (
            <PlaceName name={listing.neighborhood || listing.city} />
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

        <PursuitFields
          listingId={listing.id}
          pursuit={draft}
          pending={pending}
          onChange={(next) => {
            setDraft(next);
            startTransition(() => updatePursuit(listing.id, next));
          }}
        />

        {draft && (draft.messagedAt || draft.tourAt || draft.tourWith) && (
          <p className="text-xs leading-relaxed text-brass">
            {[
              draft.messagedAt ? "Messaged" : null,
              draft.tourAt ? `Tour ${formatFull(draft.tourAt)}` : null,
              draft.tourWith,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-ink/10 pt-3">
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
          <button
            suppressHydrationWarning
            disabled={pending}
            aria-pressed={draft != null}
            onClick={() => {
              const next = draft
                ? null
                : { messagedAt: null, tourAt: null, tourWith: null };
              setDraft(next);
              startTransition(() => updatePursuit(listing.id, next));
            }}
            className={`press inline-flex min-h-11 items-center border px-4 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50 ${
              draft
                ? "border-ink bg-metal text-ink"
                : "border-ink/20 text-ink-soft hover:border-ink hover:bg-ink hover:text-metal"
            }`}
          >
            {draft ? "Tracking" : "Track"}
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

function PlaceName({ name }: { name: string }) {
  return (
    <div className="flex h-full items-end bg-bg-deep p-4">
      <p className="font-display text-2xl italic text-ink">{name}</p>
    </div>
  );
}

const TOUR_ZONE = "America/Los_Angeles";

function tourParts(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TOUR_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = tourParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Wall-clock tour time is Pacific, matching the other dates on the card. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const guess = new Date(`${value}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const parts = tourParts(guess);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asShown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asShown - guess.getTime())).toISOString();
}

function PursuitFields({
  listingId,
  pursuit,
  pending,
  onChange,
}: {
  listingId: string;
  pursuit: Pursuit | null;
  pending: boolean;
  onChange: (next: Pursuit | null) => void;
}) {
  if (!pursuit) return null;
  const messaged = pursuit.messagedAt != null;
  return (
    <div className="mt-1 grid gap-2 border border-ink/15 bg-bg p-3">
      <button
        type="button"
        suppressHydrationWarning
        disabled={pending}
        aria-pressed={messaged}
        onClick={() =>
          onChange({
            ...pursuit,
            messagedAt: messaged ? null : new Date().toISOString(),
          })
        }
        className={`press min-h-11 border px-3 text-left text-xs uppercase tracking-[0.14em] ${
          messaged
            ? "border-ink bg-ink text-metal"
            : "border-ink/20 text-ink-soft hover:border-ink"
        }`}
      >
        {messaged ? "Messaged" : "Mark as messaged"}
      </button>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.14em] text-brass">
        Tour
        <input
          suppressHydrationWarning
          type="datetime-local"
          name={`tour-${listingId}`}
          value={toLocalInput(pursuit.tourAt)}
          onChange={(e) =>
            onChange({
              ...pursuit,
              tourAt: fromLocalInput(e.target.value),
            })
          }
          className="field-control normal-case tracking-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.14em] text-brass">
        With
        <input
          suppressHydrationWarning
          type="text"
          name={`with-${listingId}`}
          defaultValue={pursuit.tourWith ?? ""}
          placeholder="Leasing office, a name"
          onBlur={(e) => {
            const tourWith = e.target.value.trim();
            if (tourWith === (pursuit.tourWith ?? "")) return;
            onChange({ ...pursuit, tourWith: tourWith || null });
          }}
          className="field-control normal-case tracking-normal"
        />
      </label>
    </div>
  );
}
