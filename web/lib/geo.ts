export interface Coordinates {
  lat: number;
  lng: number;
}

export function haversineMiles(a: Coordinates, b: Coordinates): number {
  const R = 3959;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinHalf =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf));
}

const MAX_AREA_POINTS = 60;
const MAX_AREAS = 8;

/** One outline: `lat,lng;lat,lng;…`, at least three corners. */
export function parseArea(value: string | null | undefined): Coordinates[] | null {
  if (!value) return null;
  const points: Coordinates[] = [];
  for (const pair of value.split(";")) {
    const [lat, lng] = pair.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null;
    points.push({ lat: lat!, lng: lng! });
  }
  return points.length >= 3 && points.length <= MAX_AREA_POINTS * 2 ? points : null;
}

/** Several outlines joined by `|`, so a search can keep the north and the south. */
export function parseAreas(value: string | null | undefined): Coordinates[][] | null {
  if (!value) return null;
  const chunks = value.split("|").filter(Boolean);
  if (chunks.length === 0 || chunks.length > MAX_AREAS) return null;
  const rings: Coordinates[][] = [];
  for (const chunk of chunks) {
    const ring = parseArea(chunk);
    if (!ring) return null;
    rings.push(ring);
  }
  return rings;
}

/** Thins a freehand trace to a URL-sized outline. */
export function encodeArea(points: Coordinates[]): string {
  const step = Math.max(1, Math.ceil(points.length / MAX_AREA_POINTS));
  return points
    .filter((_, i) => i % step === 0)
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join(";");
}

export function encodeAreas(rings: Coordinates[][]): string {
  return rings
    .slice(0, MAX_AREAS)
    .map((ring) => encodeArea(ring))
    .join("|");
}

export function polygonBounds(rings: Coordinates[][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const ring of rings) {
    for (const point of ring) {
      if (point.lat < minLat) minLat = point.lat;
      if (point.lat > maxLat) maxLat = point.lat;
      if (point.lng < minLng) minLng = point.lng;
      if (point.lng > maxLng) maxLng = point.lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Ray casting; fine at city scale where lat/lng is close to flat. */
export function pointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInAnyArea(point: Coordinates, rings: Coordinates[][]): boolean {
  return rings.some((ring) => pointInPolygon(point, ring));
}

export function withinRadiusMiles(
  listing: Coordinates,
  center: Coordinates,
  radiusMiles: number,
): boolean {
  return haversineMiles(center, listing) <= radiusMiles;
}
