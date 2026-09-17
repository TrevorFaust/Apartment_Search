import type { Coordinates } from "./geo.js";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ApartmentHunt/1.0 (personal apartment search; once-daily scrape)";

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** Geocode a free-text address via OpenStreetMap Nominatim (no API key). */
export async function geocodeAddress(
  query: string,
): Promise<Coordinates | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  await throttle();
  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "1",
    countrycodes: "us",
  });

  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function buildListingGeocodeQuery(parts: {
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const segments = [
    parts.address,
    parts.neighborhood,
    parts.city,
    parts.state?.toUpperCase(),
    "USA",
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return segments.length >= 2 ? segments.join(", ") : null;
}

/** Cap geocoding per scrape run to stay polite to Nominatim. */
export const GEOCODE_BUDGET_PER_RUN = 120;
