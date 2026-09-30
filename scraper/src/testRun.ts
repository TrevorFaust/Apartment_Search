/**
 * Dev helper: runs all scrapers with given prefs and prints results without
 * touching Supabase or sending email. Usage: npm run test:sources
 */
import { launchBrowser } from "./browser.js";
import { scrapeCraigslist } from "./sources/craigslist.js";
import { scrapeApartmentsCom } from "./sources/apartmentsCom.js";
import { scrapeSeattleRentals } from "./sources/seattleRentals.js";
import type { Preferences, SearchLocation } from "./types.js";

const location: SearchLocation = { city: "seattle", state: "wa" };

const prefs: Preferences = {
  key: "default",
  city: "seattle",
  locations: [location],
  min_price: null,
  max_price: 3000,
  min_beds: null,
  min_baths: null,
  min_sqft: null,
  neighborhoods: [],
  keywords: [],
  email_to: null,
  radius_miles: null,
  radius_center: null,
  radius_center_lat: null,
  radius_center_lng: null,
};

const { browser, context } = await launchBrowser();

for (const [name, run] of [
  ["craigslist", () => scrapeCraigslist(context, prefs, location)],
  ["apartments_com", () => scrapeApartmentsCom(context, prefs, location)],
  ["seattle_rentals", () => scrapeSeattleRentals(prefs, location)],
] as const) {
  try {
    const listings = await run();
    console.log(`\n=== ${name}: ${listings.length} listings ===`);
    for (const l of listings.slice(0, 3)) {
      console.log(
        `  $${l.price ?? "?"} | ${l.bedrooms ?? "?"}bd/${l.bathrooms ?? "?"}ba | ${l.neighborhood ?? "-"} | ${l.title.slice(0, 60)}`,
      );
      console.log(`    ${l.url}`);
    }
  } catch (err) {
    console.error(`\n=== ${name} FAILED ===`, err);
  }
}

await browser.close();
