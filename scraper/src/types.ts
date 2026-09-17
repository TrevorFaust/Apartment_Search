export type Source =
  | "craigslist"
  | "apartments_com"
  | "seattle_rentals"
  | "chicago_rentals"
  | "chicago_apartment_finders"
  | "urban_abodes"
  | "domu";

export interface SearchLocation {
  city: string;
  state: string;
  center_lat?: number | null;
  center_lng?: number | null;
}

export interface ScrapedListing {
  source: Source;
  externalId: string;
  url: string;
  title: string;
  price: number | null;
  bedrooms: number | null; // 0 = studio
  bathrooms: number | null;
  sqft: number | null;
  neighborhood: string | null;
  address: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  amenities: string[];
  postedAt: string | null; // ISO timestamp if the source provides one
}

export interface Preferences {
  key: string;
  /** Legacy single city — kept in sync with locations[0]. */
  city: string;
  locations: SearchLocation[];
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  max_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  neighborhoods: string[];
  keywords: string[];
  email_to: string | null;
  radius_miles: number | null;
  radius_center: string | null;
  radius_center_lat: number | null;
  radius_center_lng: number | null;
}

export function normalizeLocations(prefs: Preferences): SearchLocation[] {
  if (prefs.locations?.length) {
    return prefs.locations.map((l) => ({
      city: l.city.toLowerCase().trim(),
      state: l.state.toLowerCase().trim(),
      center_lat: l.center_lat ?? null,
      center_lng: l.center_lng ?? null,
    }));
  }
  return [{ city: prefs.city.toLowerCase().trim(), state: "wa" }];
}
