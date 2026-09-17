import type { BrowserContext } from "playwright";
import type { Preferences, ScrapedListing, SearchLocation } from "../types.js";

const BASE = "https://www.domu.com";
const SEARCH_URL = `${BASE}/chicago-il/apartments`;

/**
 * Domu loads listings via JavaScript on its map search page. Playwright is
 * required. At the default city zoom only ~18 buildings are shown; that's
 * enough for a daily personal scrape.
 */
export async function scrapeDomu(
  context: BrowserContext,
  _prefs: Preferences,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const page = await context.newPage();
  try {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page
      .click("button.agree-button, .eu-cookie-compliance-agree-button")
      .catch(() => {});
    await page
      .waitForSelector(".domu-search-listing", { timeout: 30_000 })
      .catch(() => {});

    const items = await page.evaluate(() => {
      return [...document.querySelectorAll(".domu-search-listing")].map((el) => {
        const nid = el.getAttribute("data-nid") ?? "";
        const position = el.getAttribute("data-position") ?? "";
        const [lat, lng] = position.split(",").map(Number);
        const priceText =
          el.querySelector(".listing-price")?.textContent?.trim() ??
          el.getAttribute("data-price") ??
          "";
        const title =
          [...el.querySelectorAll("a")].find((a) =>
            /bedroom|studio/i.test(a.textContent ?? ""),
          )?.textContent?.trim() ??
          el.querySelector(".listing-title")?.textContent?.trim() ??
          "";
        const address =
          el.querySelector(".listing-address")?.textContent?.trim() ?? "";
        const linkEl = el.querySelector<HTMLAnchorElement>(
          'a[href*="/chicago/"]',
        );
        const amenities = [...el.querySelectorAll(".listing-amenities li, .listing-amenities span")]
          .map((n) => (n.textContent ?? "").trim())
          .filter(Boolean);
        const img = el.querySelector<HTMLImageElement>("img")?.src ?? null;

        return { nid, lat, lng, priceText, title, address, href: linkEl?.href ?? "", amenities, img };
      });
    });

    return items
      .filter((i) => i.nid && i.href)
      .map((i) => ({
        source: "domu" as const,
        externalId: i.nid,
        url: i.href.startsWith("http") ? i.href : `${BASE}${i.href}`,
        title: i.title || i.address || `Domu ${i.nid}`,
        price: parseDomuPrice(i.priceText),
        bedrooms: parseDomuBedrooms(i.title),
        bathrooms: null,
        sqft: null,
        neighborhood: parseDomuNeighborhood(i.title),
        address: i.address || null,
        city: location.city,
        state: location.state,
        latitude: Number.isFinite(i.lat) ? i.lat : null,
        longitude: Number.isFinite(i.lng) ? i.lng : null,
        imageUrl: i.img,
        amenities: i.amenities,
        postedAt: null,
      }));
  } finally {
    await page.close();
  }
}

function parseDomuPrice(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseDomuBedrooms(title: string): number | null {
  if (/studio/i.test(title)) return 0;
  const range = title.match(/(\d+)\s*-\s*(\d+)\s*bedroom/i);
  if (range) return Number(range[1]);
  const single = title.match(/(\d+(?:\.\d+)?)\s*bedroom/i);
  return single ? Number(single[1]) : null;
}

function parseDomuNeighborhood(title: string): string | null {
  const m = title.match(
    /(?:studio|\d+(?:\s*-\s*\d+)?)\s*bedroom\s+(.+?)\s+apartment/i,
  );
  return m?.[1]?.trim() ?? null;
}
