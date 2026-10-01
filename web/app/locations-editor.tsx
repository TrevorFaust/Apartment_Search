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
              <ul className="absolute top-full right-0 left-0 z-30 mt-1.5 max-h-48 overflow-y-auto border border-ink/20 bg-bg-elevated p-1.5 normal-case tracking-normal shadow-lift">
                {suggestions.map((s) => (
                  <li key={`${s.city}-${s.state}`}>
                    <button
                      type="button"
                      suppressHydrationWarning
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(index, s)}
                      className="block min-h-11 w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent-wash hover:text-ink"
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
              className="press inline-flex min-h-11 items-center border border-ink/20 px-3 text-xs uppercase tracking-[0.12em] text-ink-soft hover:border-ink hover:bg-ink hover:text-metal"
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
        className="press inline-flex min-h-11 items-center border border-dashed border-ink/25 px-4 text-xs uppercase tracking-[0.12em] text-ink-soft hover:border-solid hover:border-brass hover:bg-accent-wash hover:text-brass"
      >
        + Add location
      </button>
      <p className="text-[10px] normal-case tracking-normal text-ink-faint">
        Type a city name for suggestions (e.g. Chi → Chicago, IL). Each city is
        searched on its own. Craigslist and
        Apartments.com run for every location; SeattleRentals (Seattle) and the
        Chicago sites (Chicago, IL) run only for matching cities.
      </p>
    </div>
  );
}
