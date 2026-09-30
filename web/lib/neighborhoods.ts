export type NeighborhoodOption = {
  /** URL/filter token: `city:canonical` */
  value: string;
  /** Dropdown label */
  label: string;
  /** Metro shown under the label when several cities are in play. */
  sublabel?: string;
};

const CITY_NAMES = new Set([
  "seattle",
  "chicago",
  "portland",
  "austin",
  "denver",
  "boston",
  "brooklyn",
  "manhattan",
]);

const METRO_LABEL: Record<string, string> = {
  seattle: "Seattle area",
  chicago: "Chicago",
};

/** True when a scraped neighborhood value looks like an area name, not a street address. */
export function looksLikeNeighborhoodName(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 55) return false;
  const lower = v.toLowerCase();
  if (CITY_NAMES.has(lower)) return false;
  if (/^(seattle|chicago)(\s+(wa|il))?$/i.test(v)) return false;

  if (/^\d+\s/.test(v)) return false;
  if (/,\s*[A-Z]{2}\s*$/i.test(v)) return false;
  if (/,/.test(v) && /\d/.test(v)) return false;
  if (
    /^\d+.*\b(st|street|ste|ave|avenue|blvd|dr|drive|rd|road|way|ln|lane|ct|court|pl|place|pkwy|hwy)\b/i.test(
      v,
    )
  ) {
    return false;
  }

  const beforeComma = v.split(",")[0]?.trim() ?? v;
  if (
    /\b(st|street|ste|ave|avenue|blvd|dr|drive|rd|road|way|ln|lane)\b/i.test(
      beforeComma,
    ) &&
    /\d/.test(beforeComma)
  ) {
    return false;
  }

  return true;
}

function titleCaseWords(text: string): string {
  return text
    .split(/([\s-]+)/)
    .map((part) =>
      /^[\s-]+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}

/** Reduce raw scraped strings to one canonical neighborhood name within a search city. */
export function canonicalNeighborhood(
  searchCity: string,
  raw: string,
): string | null {
  const city = searchCity.toLowerCase().trim();
  const v = raw.trim();
  if (!looksLikeNeighborhoodName(v)) return null;

  // Skip multi-municipality laundry lists.
  if (v.includes(",") && v.split(",").length >= 3) return null;

  // Seattle: "Lower Queen Anne - Uptown" is not the same as Chicago Uptown.
  if (city === "seattle" && /lower queen anne/i.test(v)) {
    return "Lower Queen Anne";
  }
  if (city === "seattle" && /^uptown\b/i.test(v) && !/queen anne/i.test(v)) {
    return null;
  }

  // "Parent - child detail" → parent (Renton - Skyway → Renton).
  const dashParent = v.match(/^([A-Za-z][A-Za-z\s.'-]{1,30}?)\s-\s+.+/);
  if (dashParent) {
    const parent = dashParent[1].trim();
    if (looksLikeNeighborhoodName(parent)) return titleCaseWords(parent);
  }

  // Directional prefix: "N.E. Renton" → Renton.
  const dirPrefix = v.match(
    /^(?:N\.?\s*E\.?|N\.?\s*W\.?|S\.?\s*E\.?|S\.?\s*W\.?|NE|NW|SE|SW)\.?\s+([A-Za-z].+)$/i,
  );
  if (dirPrefix) {
    const core = dirPrefix[1].trim();
    if (looksLikeNeighborhoodName(core)) return titleCaseWords(core);
  }

  // "Renton Highlands", "Renton Valley" → Renton.
  const suffixParent = v.match(
    /^([A-Za-z][A-Za-z\s.'-]{1,24}?)\s+(?:Highlands|Heights|Valley|Landing|Downtown|Park|Plaza|Square|District|Beach|Center|Centre|Village|Hills|Ridge|Terrace|Gardens|Crossing|Commons|Shores|Woods|Meadows|Estates|Grove|Springs|Lake|Lakes|Harbor|Harbour|Junction|Summit|Bluffs|Orchard|Orchards|Reserve|Residences)(?:\s|\(|$)/i,
  );
  if (suffixParent) {
    const parent = suffixParent[1].trim();
    if (looksLikeNeighborhoodName(parent)) return titleCaseWords(parent);
  }

  // "Cascade / SE Renton" → Renton.
  if (v.includes("/")) {
    const parts = v.split(/\s*\/\s*/).map((p) => p.trim());
    for (const part of [...parts].reverse()) {
      const core = part
        .replace(/^(?:SE|SW|NE|NW|N\.E\.|S\.E\.|N\.W\.|S\.W\.)\s+/i, "")
        .trim();
      if (looksLikeNeighborhoodName(core)) return titleCaseWords(core);
    }
  }

  // "Renton/Bellevue" → first segment.
  if (v.includes("/") && !v.includes(" / ")) {
    const first = v.split("/")[0]?.trim();
    if (first && looksLikeNeighborhoodName(first)) return titleCaseWords(first);
  }

  // Comma-separated: take first valid segment only when it's a single extra qualifier.
  if (v.includes(",")) {
    const parts = v
      .split(",")
      .map((p) => p.trim())
      .filter((p) => looksLikeNeighborhoodName(p));
    if (parts.length === 1) return titleCaseWords(parts[0]!);
    if (parts.length === 2) return titleCaseWords(parts[0]!);
    return null;
  }

  return titleCaseWords(v);
}

export function neighborhoodFilterToken(
  searchCity: string,
  canonical: string,
): string {
  return `${searchCity.toLowerCase()}:${canonical}`;
}

export function parseNeighborhoodFilter(value: string): {
  city: string;
  name: string;
} {
  const idx = value.indexOf(":");
  if (idx === -1) {
    return { city: "", name: value };
  }
  return {
    city: value.slice(0, idx).toLowerCase(),
    name: value.slice(idx + 1),
  };
}

export function neighborhoodFilterLabel(
  value: string,
  activeCities: string[] = [],
): string {
  const { city, name } = parseNeighborhoodFilter(value);
  if (!city) return name;
  if (activeCities.length === 1 && activeCities[0]?.toLowerCase() === city) {
    return name;
  }
  const metro = METRO_LABEL[city] ?? titleCaseWords(city);
  return `${name} · ${metro}`;
}

export function buildNeighborhoodOptions(
  pairs: Array<{ city: string; neighborhood: string }>,
  activeCities: string[] = [],
): NeighborhoodOption[] {
  const scopedCities =
    activeCities.length > 0
      ? new Set(activeCities.map((c) => c.toLowerCase()))
      : null;

  const byKey = new Map<string, NeighborhoodOption>();

  for (const { city, neighborhood } of pairs) {
    const searchCity = city.toLowerCase().trim();
    if (scopedCities && !scopedCities.has(searchCity)) continue;

    const canonical = canonicalNeighborhood(searchCity, neighborhood);
    if (!canonical) continue;

    const value = neighborhoodFilterToken(searchCity, canonical);
    if (byKey.has(value)) continue;

    const metro = METRO_LABEL[searchCity] ?? titleCaseWords(searchCity);
    byKey.set(
      value,
      scopedCities?.size === 1
        ? { value, label: canonical }
        : { value, label: canonical, sublabel: metro },
    );
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.label.localeCompare(b.label) ||
      (a.sublabel ?? "").localeCompare(b.sublabel ?? ""),
  );
}
