export type Source = "craigslist" | "apartments_com" | "seattle_rentals";

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
  imageUrl: string | null;
  amenities: string[];
  postedAt: string | null; // ISO timestamp if the source provides one
}

export interface Preferences {
  key: string;
  city: string;
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  max_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  neighborhoods: string[];
  keywords: string[];
  email_to: string | null;
}
