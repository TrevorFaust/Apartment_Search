import "./env.js";
import { launchBrowser } from "./browser.js";
import { scrapeCraigslist } from "./sources/craigslist.js";
import { scrapeApartmentsCom } from "./sources/apartmentsCom.js";
import { scrapeSeattleRentals } from "./sources/seattleRentals.js";
import { loadPreferences, storeListings, recordRun } from "./supabase.js";
import { matchesPreferences } from "./filter.js";
import { sendNewsletter } from "./email.js";
import type { ScrapedListing } from "./types.js";

const startedAt = new Date().toISOString();
const sourceCounts: Record<string, number> = {};
let runError: string | null = null;
let emailSent = false;
let newCount = 0;

async function main() {
  const prefs = await loadPreferences();
  console.log(`Preferences: city=${prefs.city}, price=${prefs.min_price ?? "-"}..${prefs.max_price ?? "-"}, beds=${prefs.min_beds ?? "-"}..${prefs.max_beds ?? "-"}`);

  const { browser, context } = await launchBrowser();
  const all: ScrapedListing[] = [];

  // Run sources sequentially and keep going if one fails — a blocked site
  // shouldn't kill the whole digest.
  const sources: Array<[string, () => Promise<ScrapedListing[]>]> = [
    ["craigslist", () => scrapeCraigslist(context, prefs)],
    ["apartments_com", () => scrapeApartmentsCom(context, prefs)],
  ];
  if (prefs.city.toLowerCase() === "seattle") {
    sources.push(["seattle_rentals", () => scrapeSeattleRentals(prefs)]);
  }

  for (const [name, run] of sources) {
    try {
      const listings = await run();
      sourceCounts[name] = listings.length;
      all.push(...listings);
      console.log(`${name}: ${listings.length} listings`);
    } catch (err) {
      sourceCounts[name] = -1;
      console.error(`${name} failed:`, err);
      runError = `${runError ? runError + "; " : ""}${name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  await browser.close();

  const newListings = await storeListings(all);
  newCount = newListings.length;
  console.log(`Stored ${all.length} listings, ${newCount} new`);

  const matching = newListings.filter((l) => matchesPreferences(l, prefs));
  const emailTo = prefs.email_to ?? process.env.EMAIL_TO;

  if (matching.length === 0) {
    console.log("No new matching listings — skipping email.");
  } else if (!emailTo || !process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY or recipient not configured — skipping email.");
  } else {
    await sendNewsletter(matching, emailTo);
    emailSent = true;
    console.log(`Newsletter sent to ${emailTo} with ${matching.length} listings.`);
  }
}

main()
  .catch((err) => {
    runError = err instanceof Error ? err.message : String(err);
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await recordRun({
      startedAt,
      sourceCounts,
      newListingCount: newCount,
      emailSent,
      error: runError,
    });
  });
