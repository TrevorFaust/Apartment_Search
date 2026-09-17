export const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": FETCH_UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function parsePrice(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function parseBedrooms(text: string): number | null {
  if (/studio/i.test(text)) return 0;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:bed|bd|br|bedroom)/i);
  return m ? Number(m[1]) : null;
}

export function parseBathrooms(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:bath|bt|ba|bathroom)/i);
  return m ? Number(m[1]) : null;
}
