import { chromium, type Browser, type BrowserContext } from "playwright";

const ARGS = ["--disable-blink-features=AutomationControlled"];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

/**
 * Apartments.com's bot protection blocks bundled headless Chromium but lets
 * real Chrome through, so prefer the stable Chrome channel (preinstalled on
 * GitHub Actions runners and most dev machines).
 */
export async function launchBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  // Headed mode (HEADFUL=1, wrapped in xvfb-run on CI) has a much more
  // convincing fingerprint against bot protection.
  const headless = process.env.HEADFUL !== "1";
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless, args: ARGS });
  } catch {
    console.warn("Chrome stable not found, falling back to bundled Chromium.");
    browser = await chromium.launch({ headless, args: ARGS });
  }
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1600, height: 900 },
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  return { browser, context };
}
