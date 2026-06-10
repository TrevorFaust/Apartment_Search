import type { BrowserContext } from "playwright";
import type { Preferences, ScrapedListing } from "../types.js";

/**
 * Craigslist removed its RSS feeds in 2023, so we scrape the search results
 * page with Playwright instead. Filters (price/beds/baths/sqft) are passed
 * directly in the search URL so Craigslist does the filtering for us.
 */
export async function scrapeCraigslist(
  context: BrowserContext,
  prefs: Preferences,
): Promise<ScrapedListing[]> {
  const params = new URLSearchParams();
  if (prefs.min_price != null) params.set("min_price", String(prefs.min_price));
  if (prefs.max_price != null) params.set("max_price", String(prefs.max_price));
  if (prefs.min_beds != null && prefs.min_beds > 0)
    params.set("min_bedrooms", String(Math.floor(prefs.min_beds)));
  if (prefs.max_beds != null)
    params.set("max_bedrooms", String(Math.ceil(prefs.max_beds)));
  if (prefs.min_baths != null && prefs.min_baths > 0)
    params.set("min_bathrooms", String(Math.floor(prefs.min_baths)));
  if (prefs.min_sqft != null) params.set("minSqft", String(prefs.min_sqft));

  // City subdomain, e.g. seattle.craigslist.org. Works for most US cities.
  const subdomain = prefs.city.toLowerCase().replace(/[^a-z]/g, "");
  const url = `https://${subdomain}.craigslist.org/search/apa?${params.toString()}`;

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page
      .waitForSelector(".cl-search-result[data-pid], li.cl-static-search-result", {
        timeout: 30_000,
      })
      .catch(() => {});

    const items = await page.evaluate(() => {
      const results: Array<{
        pid: string;
        url: string;
        title: string;
        priceText: string;
        bedsText: string;
        sqftText: string;
        location: string;
        imageUrl: string | null;
      }> = [];

      // JS-rendered gallery results: <div data-pid class="cl-search-result">
      document.querySelectorAll(".cl-search-result[data-pid]").forEach((el) => {
        const pid = el.getAttribute("data-pid") ?? "";
        const link =
          el.querySelector<HTMLAnchorElement>("a.posting-title") ??
          el.querySelector<HTMLAnchorElement>("a.main");
        if (!pid || !link?.href) return;
        const title =
          el.querySelector(".posting-title .label")?.textContent ??
          el.getAttribute("title") ??
          "";
        results.push({
          pid,
          url: link.href,
          title: title.trim(),
          priceText: (el.querySelector(".priceinfo")?.textContent ?? "").trim(),
          bedsText: (el.querySelector(".post-bedrooms")?.textContent ?? "").trim(),
          sqftText: (el.querySelector(".post-sqft")?.textContent ?? "").trim(),
          location: (el.querySelector(".result-location")?.textContent ?? "").trim(),
          imageUrl: el.querySelector<HTMLImageElement>(".cl-gallery img")?.src ?? null,
        });
      });

      // Static no-JS fallback markup
      if (results.length === 0) {
        document.querySelectorAll("li.cl-static-search-result").forEach((li) => {
          const anchor = li.querySelector<HTMLAnchorElement>("a");
          if (!anchor?.href) return;
          const pidMatch = anchor.href.match(/\/(\d+)\.html/);
          results.push({
            pid: pidMatch?.[1] ?? anchor.href,
            url: anchor.href,
            title: (li.querySelector(".title")?.textContent ?? "").trim(),
            priceText: (li.querySelector(".price")?.textContent ?? "").trim(),
            bedsText: "",
            sqftText: "",
            location: (li.querySelector(".location")?.textContent ?? "").trim(),
            imageUrl: null,
          });
        });
      }

      return results;
    });

    return items
      .filter((i) => i.title)
      .map((i) => ({
        source: "craigslist" as const,
        externalId: i.pid,
        url: i.url.split("#")[0],
        title: i.title,
        price: parsePrice(i.priceText),
        bedrooms: matchNumber(i.bedsText, /(\d+(?:\.\d+)?)\s*br/i),
        bathrooms: null,
        sqft: matchNumber(i.sqftText, /(\d+)\s*ft/i),
        neighborhood: i.location || null,
        address: null,
        city: prefs.city,
        imageUrl: i.imageUrl,
        amenities: [],
        postedAt: null,
      }));
  } finally {
    await page.close();
  }
}

function parsePrice(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function matchNumber(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}
