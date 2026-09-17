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

export function withinRadiusMiles(
  listing: Coordinates,
  center: Coordinates,
  radiusMiles: number,
): boolean {
  return haversineMiles(center, listing) <= radiusMiles;
}
