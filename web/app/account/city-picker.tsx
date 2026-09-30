"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NeighborhoodOption } from "@/lib/neighborhoods";
import type { AlertLocation, CityCount } from "@/lib/subscribers";
import { US_CITIES, searchUsCities, type UsCity } from "@/lib/us-cities";
import { MultiSelectFilter } from "../multi-select-filter";

const titleWords = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
const display = (l: AlertLocation) => `${titleWords(l.city)}, ${l.state.toUpperCase()}`;
const toLocation = (c: UsCity): AlertLocation => ({
  city: c.city.toLowerCase(),
  state: c.state.toLowerCase(),
});

/** "Austin, TX" → location; a bare name only resolves when it's a known city. */
function parseTyped(text: string): AlertLocation | null {
  const [rawCity, rawState] = text.split(",").map((s) => s.trim());
  if (!rawCity) return null;
  if (rawState && /^[a-z]{2}$/i.test(rawState)) {
    return { city: rawCity.toLowerCase(), state: rawState.toLowerCase() };
  }
  const known = US_CITIES.filter((c) => c.city.toLowerCase() === rawCity.toLowerCase());
  return known.length === 1 ? toLocation(known[0]!) : null;
}

export function CityPicker({
  initial,
  covered,
  neighborhoodOptions,
  selectedNeighborhoods,
}: {
  initial: AlertLocation[];
  covered: CityCount[];
  neighborhoodOptions: NeighborhoodOption[];
  selectedNeighborhoods: string[];
}) {
  const [picked, setPicked] = useState<AlertLocation[]>(initial);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const pickedCities = new Set(picked.map((l) => l.city));
  const suggestions = searchUsCities(text, 6).filter(
    (c) => !pickedCities.has(c.city.toLowerCase()),
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const add = (loc: AlertLocation) => {
    setPicked((prev) =>
      prev.some((l) => l.city === loc.city) || prev.length >= 10 ? prev : [...prev, loc],
    );
    setText("");
    setHint(null);
    setHighlight(0);
  };

  const commitTyped = () => {
    const pick = suggestions[highlight];
    if (pick) return add(toLocation(pick));
    const typed = parseTyped(text);
    if (typed) return add(typed);
    if (text.trim()) setHint('Add the state too, like "Boise, ID".');
  };

  const neighborhoods = useMemo(
    () =>
      neighborhoodOptions.filter((o) => {
        const city = o.value.slice(0, o.value.indexOf(":"));
        return picked.some((l) => l.city === city);
      }),
    [neighborhoodOptions, picked],
  );
  const neighborhoodKey = picked.map((l) => l.city).join("|");

  return (
    <div className="space-y-3">
      <input type="hidden" name="locations_json" value={JSON.stringify(picked)} />

      <div ref={boxRef} className="relative">
        <div className="field-control flex min-h-11 flex-wrap items-center gap-1.5 py-1.5!">
          {picked.map((l) => (
            <span
              key={l.city}
              className="flex min-h-11 items-center gap-1 bg-ink py-1 pr-1 pl-3 text-sm text-metal"
            >
              {display(l)}
              <button
                type="button"
                aria-label={`Remove ${display(l)}`}
                onClick={() => setPicked((prev) => prev.filter((p) => p.city !== l.city))}
                className="flex size-8 items-center justify-center text-sm hover:bg-bg-elevated/25"
              >
                ×
              </button>
            </span>
          ))}
          <input
            suppressHydrationWarning
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setHighlight(0);
              setHint(null);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTyped();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Backspace" && !text && picked.length) {
                setPicked((prev) => prev.slice(0, -1));
              }
            }}
            placeholder={picked.length ? "Add another city" : "Type any US city, e.g. Denver"}
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-ink-faint"
          />
        </div>

        {open && text.trim().length >= 2 && (
          <ul className="rise absolute top-full right-0 left-0 z-30 mt-1.5 border border-ink/20 bg-bg-elevated p-1.5 shadow-lift [animation-duration:160ms]">
            {suggestions.map((s, i) => (
              <li key={`${s.city}-${s.state}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => add(toLocation(s))}
                  className={`block min-h-11 w-full px-3 py-2 text-left text-sm transition-colors ${
                    i === highlight ? "bg-accent-wash text-accent-dim" : ""
                  }`}
                >
                  {`${s.city}, ${s.state}`}
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-faint">
                Not in our list. Press Enter to add it as &ldquo;City, ST&rdquo;.
              </li>
            )}
          </ul>
        )}
      </div>

      {hint && <p className="text-xs text-accent-dim">{hint}</p>}

      {covered.some((c) => !pickedCities.has(c.city)) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-faint">Already tracking:</span>
          {covered
            .filter((c) => !pickedCities.has(c.city) && c.state)
            .map((c) => (
              <button
                key={c.city}
                type="button"
                onClick={() => add({ city: c.city, state: c.state })}
                className="press inline-flex min-h-11 items-center border border-dashed border-ink/25 px-3 text-xs uppercase tracking-[0.12em] text-ink-soft hover:border-solid hover:border-brass hover:bg-accent-wash hover:text-brass"
              >
                + {titleWords(c.city)} · {c.count.toLocaleString()} listings
              </button>
            ))}
        </div>
      )}

      {neighborhoods.length > 0 && (
        <div className="max-w-sm">
          <MultiSelectFilter
            key={neighborhoodKey}
            name="neighborhoods"
            label="Neighborhoods (optional)"
            options={neighborhoods}
            selected={selectedNeighborhoods.filter((n) =>
              neighborhoods.some((o) => o.value === n),
            )}
            emptyLabel="Anywhere in those cities"
          />
        </div>
      )}
    </div>
  );
}
