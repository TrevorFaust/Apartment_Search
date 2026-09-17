import type { BrowserContext } from "playwright";
import type { Preferences, ScrapedListing, SearchLocation } from "../types.js";

const BASE = "https://www.urbanabodes.com";
const SEARCH_URL = `${BASE}/search`;

/**
 * UrbanAbodes is a Next.js app; listings render client-side on /search.
 * Playwright loads the page and reads the listing cards from the DOM.
 */
export async function scrapeUrbanAbodes(
  context: BrowserContext,
  _prefs: Preferences,
  location: SearchLocation,
): Promise<ScrapedListing[]> {
  const page = await context.newPage();
  try {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page
      .waitForSelector(".listing_cards", { timeout: 60_000 })
      .catch(() => {});
    // Let React finish rendering cards without waiting for every image.
    await page.waitForTimeout(3000);

    const items = await page.evaluate(() => {
      return [...document.querySelectorAll(".listing_cards")].map((card) => {
        const link = card.querySelector<HTMLAnchorElement>('a[href*="/apartment/"]');
        const href = link?.getAttribute("href") ?? "";
        const idMatch = href.match(/\/apartment\/(\d+)\.html/);
        const neighborhood =
          card.querySelector(".info strong.text-uppercase")?.textContent?.trim() ?? "";
        const detailLines = [...card.querySelectorAll(".left_side .info p")]
          .map((p) => (p.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean);
        const buildingLine = detailLines.find((l) => !/^SF\s-/i.test(l)) ?? "";
        const sqftMatch = detailLines.join(" ").match(/SF\s*-\s*(\d+)/i);
        const priceText =
          card.querySelector(".right_side .info strong")?.textContent?.trim() ?? "";
        const bedBathText =
          card.querySelector(".right_side .info p")?.textContent?.trim() ?? "";
        const img = card.querySelector<HTMLImageElement>("img")?.src ?? null;

        return {
          id: idMatch?.[1] ?? "",
          href,
          neighborhood,
          buildingLine,
          sqft: sqftMatch?.[1] ?? null,
          priceText,
          bedBathText,
          img,
        };
      });
    });

    return items
      .filter((i) => i.id && i.href)
      .map((i) => ({
        source: "urban_abodes" as const,
        externalId: i.id,
        url: i.href.startsWith("http") ? i.href : `${BASE}${i.href}`,
        title: i.buildingLine.replace(/\s*Available:.*/i, "").trim() || `Unit ${i.id}`,
        price: parseUaPrice(i.priceText),
        bedrooms: parseUaBedrooms(i.bedBathText),
        bathrooms: parseUaBathrooms(i.bedBathText),
        sqft: i.sqft ? Number(i.sqft) : null,
        neighborhood: i.neighborhood || null,
        address: i.buildingLine.split(/Available:/i)[0]?.trim() || null,
        city: location.city,
        state: location.state,
        latitude: null,
        longitude: null,
        imageUrl: i.img,
        amenities: [],
        postedAt: null,
      }));
  } finally {
    await page.close();
  }
}

function parseUaPrice(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseUaBedrooms(text: string): number | null {
  if (/studio/i.test(text)) return 0;
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  return m ? Number(m[1]) : null;
}

function parseUaBathrooms(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*bath/i);
  return m ? Number(m[1]) : null;
}
