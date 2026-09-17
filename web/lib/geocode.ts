import type { Coordinates } from "./geo";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ApartmentHunt/1.0 (personal apartment search)";

export async function geocodeAddress(
  query: string,
): Promise<Coordinates | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "1",
    countrycodes: "us",
  });

  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 86400 },
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

/** Downtown / city-center geocode for radius filtering. */
export async function geocodeCityCenter(
  city: string,
  state: string,
): Promise<Coordinates | null> {
  const st = state.toUpperCase();
  return (
    (await geocodeAddress(`Downtown ${city}, ${st}, USA`)) ??
    (await geocodeAddress(`${city}, ${st}, USA`))
  );
}
