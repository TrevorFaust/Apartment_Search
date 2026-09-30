import type { Preferences, ScrapedListing } from "./types.js";
import { withinRadiusMiles } from "./geo.js";

function listingWithinConfiguredRadius(
  l: ScrapedListing,
  prefs: Preferences,
): boolean {
  if (prefs.radius_miles == null) return true;
  if (l.latitude == null || l.longitude == null) return false;

  const loc = prefs.locations.find(
    (entry) =>
      entry.city === l.city.toLowerCase() &&
      entry.state === l.state.toLowerCase(),
  );

  const centerLat = loc?.center_lat ?? prefs.radius_center_lat;
  const centerLng = loc?.center_lng ?? prefs.radius_center_lng;
  if (centerLat == null || centerLng == null) return true;

  return withinRadiusMiles(
    { lat: centerLat, lng: centerLng },
    { lat: l.latitude, lng: l.longitude },
    prefs.radius_miles,
  );
}

/**
 * Applies user preferences to a listing for the newsletter. Listings with
 * missing data for a criterion pass that criterion (better to over-include
 * than silently drop a good apartment).
 */
export function matchesPreferences(l: ScrapedListing, prefs: Preferences): boolean {
  if (!matchesCriteria(l, prefs)) return false;

  if (prefs.keywords.length > 0) {
    const haystack = [l.title, ...(l.amenities ?? [])].join(" ").toLowerCase();
    const ok = prefs.keywords.some((k) => haystack.includes(k.toLowerCase()));
    if (!ok) return false;
  }

  if (!listingWithinConfiguredRadius(l, prefs)) return false;

  return true;
}

export type Criteria = {
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  neighborhoods: string[];
};

type MatchableListing = Pick<
  ScrapedListing,
  "price" | "bedrooms" | "bathrooms" | "sqft" | "neighborhood" | "city"
>;

/** Price/size/neighborhood checks shared by the owner newsletter and subscriber digests. */
export function matchesCriteria(l: MatchableListing, c: Criteria): boolean {
  if (c.min_price != null && l.price != null && l.price < c.min_price) return false;
  if (c.max_price != null && l.price != null && l.price > c.max_price) return false;
  if (c.min_beds != null && l.bedrooms != null && l.bedrooms < c.min_beds) return false;
  if (c.min_baths != null && l.bathrooms != null && l.bathrooms < c.min_baths) return false;
  if (c.min_sqft != null && l.sqft != null && l.sqft < c.min_sqft) return false;

  if (c.neighborhoods.length > 0 && l.neighborhood) {
    const ok = c.neighborhoods.some((pref) => prefNeighborhoodMatches(l, pref));
    if (!ok) return false;
  }
  return true;
}

function prefNeighborhoodMatches(
  listing: MatchableListing,
  pref: string,
): boolean {
  const hood = listing.neighborhood?.toLowerCase() ?? "";
  if (!hood) return false;

  let city = "";
  let name = pref.trim();
  const idx = name.indexOf(":");
  if (idx !== -1) {
    city = name.slice(0, idx).toLowerCase();
    name = name.slice(idx + 1);
  }

  if (city && listing.city.toLowerCase() !== city) return false;
  return hood.includes(name.toLowerCase());
}
