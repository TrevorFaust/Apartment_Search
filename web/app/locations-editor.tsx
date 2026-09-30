"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCityOption,
  normalizeLocationInput,
  searchUsCities,
  type UsCity,
} from "@/lib/us-cities";

type LocationRow = { city: string; state: string };

function titleCaseCity(city: string): string {
  return city
    .split(/([\s-]+)/)
    .map((part) =>
      /^[\s-]+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}

function toDisplayRow(loc: { city: string; state: string }): LocationRow {
  return {
    city: titleCaseCity(loc.city),
    state: loc.state.toUpperCase(),
  };
}

export function LocationsEditor({
  initialLocations,
}: {
  initialLocations: Array<{ city: string; state: string }>;
}) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LocationRow[]>(() =>
    initialLocations.length > 0
      ? initialLocations.map(toDisplayRow)
      : [{ city: "Seattle", state: "WA" }],
  );
  const [suggestions, setSuggestions] = useState<UsCity[]>([]);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = hiddenRef.current?.closest("form");
    if (!form) return;

    const onSubmit = () => {
      if (!hiddenRef.current) return;
      const normalized = rows
        .map((r) => normalizeLocationInput(r.city, r.state))
        .filter((r) => r.city && r.state);
      hiddenRef.current.value = JSON.stringify(normalized);
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [rows]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setActiveRow(null);
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const updateRow = (index: number, field: keyof LocationRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    if (field === "city") {
      setActiveRow(index);
      setSuggestions(searchUsCities(value));
    }
  };

  const pickSuggestion = (index: number, pick: UsCity) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { city: pick.city, state: pick.state } : row,
      ),
    );
    setActiveRow(null);
    setSuggestions([]);
  };

  return (
    <div className="space-y-3" ref={dropdownRef}>
      <input
        ref={hiddenRef}
        type="hidden"
        name="locations_json"
        defaultValue="[]"
      />
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <label className="relative flex min-w-[8rem] flex-1 flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
            City
            <input
              suppressHydrationWarning
              value={row.city}
              onChange={(e) => updateRow(index, "city", e.target.value)}
              onFocus={() => {
                setActiveRow(index);
                setSuggestions(searchUsCities(row.city));
              }}
              placeholder="Chicago"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              name={`apt-hunt-city-${index}`}
              data-1p-ignore
              data-lpignore="true"
              className="field-control normal-case tracking-normal"
            />
            {activeRow === index && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto border border-line bg-bg-elevated shadow-[3px_3px_0_0_var(--color-accent)]">
                {suggestions.map((s) => (
                  <li key={`${s.city}-${s.state}`}>
                    <button
                      type="button"
                      suppressHydrationWarning
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(index, s)}
                      className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent-wash hover:text-accent-dim"
                    >
                      {formatCityOption(s)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="flex w-20 flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
            State
            <input
              suppressHydrationWarning
              value={row.state}
              onChange={(e) => updateRow(index, "state", e.target.value)}
              placeholder="IL"
              maxLength={2}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name={`apt-hunt-state-${index}`}
              data-1p-ignore
              data-lpignore="true"
              className="field-control uppercase tracking-normal"
            />
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              className="press border border-ink/25 px-2 py-1.5 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setRows((prev) => [...prev, { city: "", state: "" }])}
        className="press border border-dashed border-ink/30 px-3 py-1.5 text-xs text-ink-soft hover:border-solid hover:border-accent hover:bg-accent-wash hover:text-accent-dim"
      >
        + Add location
      </button>
      <p className="text-[10px] normal-case tracking-normal text-ink-faint">
        Type a city name for suggestions (e.g. Chi → Chicago, IL). Saved as
        lowercase for scraping. Each city is scraped separately. Craigslist and
        Apartments.com run for every location; SeattleRentals (Seattle) and the
        Chicago sites (Chicago, IL) run only for matching cities.
      </p>
    </div>
  );
}
