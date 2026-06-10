/**
 * Dev helper: runs all scrapers with given prefs and prints results without
 * touching Supabase or sending email. Usage: npm run test:sources
 */
import { launchBrowser } from "./browser.js";
import { scrapeCraigslist } from "./sources/craigslist.js";
import { scrapeApartmentsCom } from "./sources/apartmentsCom.js";
import { scrapeSeattleRentals } from "./sources/seattleRentals.js";
import type { Preferences } from "./types.js";

const prefs: Preferences = {
  key: "default",
  city: "seattle",
  min_price: null,
  max_price: 3000,
  min_beds: null,
  max_beds: null,
  min_baths: null,
  min_sqft: null,
  neighborhoods: [],
  keywords: [],
  email_to: null,
};

const { browser, context } = await launchBrowser();

for (const [name, run] of [
  ["craigslist", () => scrapeCraigslist(context, prefs)],
  ["apartments_com", () => scrapeApartmentsCom(context, prefs)],
  ["seattle_rentals", () => scrapeSeattleRentals(prefs)],
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
