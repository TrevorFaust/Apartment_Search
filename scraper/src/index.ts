import "./env.js";

import { launchBrowser } from "./browser.js";

import { scrapeCraigslist } from "./sources/craigslist.js";

import { scrapeApartmentsCom } from "./sources/apartmentsCom.js";

import { scrapeSeattleRentals } from "./sources/seattleRentals.js";

import { scrapeChicagoRentals } from "./sources/chicagoRentals.js";

import { scrapeChicagoApartmentFinders } from "./sources/chicagoApartmentFinders.js";

import { scrapeUrbanAbodes } from "./sources/urbanAbodes.js";

import { scrapeDomu } from "./sources/domu.js";

import { loadPreferences, storeListings, recordRun } from "./supabase.js";

import { matchesPreferences } from "./filter.js";

import { sendNewsletter } from "./email.js";

import type { BrowserContext } from "playwright";

import type { ScrapedListing, SearchLocation } from "./types.js";

import type { Preferences } from "./types.js";



const startedAt = new Date().toISOString();

const sourceCounts: Record<string, number> = {};

let runError: string | null = null;

let emailSent = false;

let newCount = 0;



function buildSources(

  context: BrowserContext,

  prefs: Preferences,

  location: SearchLocation,

): Array<[string, () => Promise<ScrapedListing[]>]> {

  const sources: Array<[string, () => Promise<ScrapedListing[]>]> = [

    ["craigslist", () => scrapeCraigslist(context, prefs, location)],

    ["apartments_com", () => scrapeApartmentsCom(context, prefs, location)],

  ];



  if (location.city === "seattle") {

    sources.push([

      "seattle_rentals",

      () => scrapeSeattleRentals(prefs, location),

    ]);

  }



  if (location.city === "chicago" && location.state === "il") {

    sources.push(

      ["chicago_rentals", () => scrapeChicagoRentals(prefs, location)],

      [

        "chicago_apartment_finders",

        () => scrapeChicagoApartmentFinders(prefs, location),

      ],

      ["urban_abodes", () => scrapeUrbanAbodes(context, prefs, location)],

      ["domu", () => scrapeDomu(context, prefs, location)],

    );

  }



  return sources;

}



async function scrapeLocation(

  context: BrowserContext,

  prefs: Preferences,

  location: SearchLocation,

): Promise<ScrapedListing[]> {

  const all: ScrapedListing[] = [];

  const label = `${location.city}-${location.state}`;



  for (const [name, run] of buildSources(context, prefs, location)) {

    const key = `${name}:${label}`;

    try {

      const listings = await run();

      sourceCounts[key] = listings.length;

      all.push(...listings);

      console.log(`${key}: ${listings.length} listings`);

    } catch (err) {

      sourceCounts[key] = -1;

      console.error(`${key} failed:`, err);

      runError = `${runError ? runError + "; " : ""}${key}: ${err instanceof Error ? err.message : String(err)}`;

    }

  }



  return all;

}



async function main() {

  const prefs = await loadPreferences();

  const locations = prefs.locations;

  console.log(

    `Preferences: locations=${locations.map((l) => `${l.city}-${l.state}`).join(", ")}, price=${prefs.min_price ?? "-"}..${prefs.max_price ?? "-"}, beds=${prefs.min_beds ?? "-"}..${prefs.max_beds ?? "-"}, radius=${prefs.radius_miles ?? "none"}`,

  );



  const { browser, context } = await launchBrowser();

  const all: ScrapedListing[] = [];



  for (const location of locations) {

    console.log(`Scraping ${location.city}, ${location.state.toUpperCase()}...`);

    all.push(...(await scrapeLocation(context, prefs, location)));

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

