import type { Preferences, ScrapedListing } from "./types.js";

/**
 * Applies user preferences to a listing for the newsletter. Listings with
 * missing data for a criterion pass that criterion (better to over-include
 * than silently drop a good apartment).
 */
export function matchesPreferences(l: ScrapedListing, prefs: Preferences): boolean {
  if (prefs.min_price != null && l.price != null && l.price < prefs.min_price) return false;
  if (prefs.max_price != null && l.price != null && l.price > prefs.max_price) return false;
  if (prefs.min_beds != null && l.bedrooms != null && l.bedrooms < prefs.min_beds) return false;
  if (prefs.max_beds != null && l.bedrooms != null && l.bedrooms > prefs.max_beds) return false;
  if (prefs.min_baths != null && l.bathrooms != null && l.bathrooms < prefs.min_baths) return false;
  if (prefs.min_sqft != null && l.sqft != null && l.sqft < prefs.min_sqft) return false;

  if (prefs.neighborhoods.length > 0 && l.neighborhood) {
    const hood = l.neighborhood.toLowerCase();
    const ok = prefs.neighborhoods.some((n) => hood.includes(n.toLowerCase()));
    if (!ok) return false;
  }

  if (prefs.keywords.length > 0) {
    const haystack = [l.title, ...(l.amenities ?? [])].join(" ").toLowerCase();
    const ok = prefs.keywords.some((k) => haystack.includes(k.toLowerCase()));
    if (!ok) return false;
  }

  return true;
}
