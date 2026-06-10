import { Resend } from "resend";
import type { ScrapedListing } from "./types.js";

const SOURCE_LABELS: Record<string, string> = {
  craigslist: "Craigslist",
  apartments_com: "Apartments.com",
  seattle_rentals: "SeattleRentals",
};

const MAX_LISTINGS_IN_EMAIL = 50;

export async function sendNewsletter(
  listings: ScrapedListing[],
  to: string,
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const shown = listings.slice(0, MAX_LISTINGS_IN_EMAIL);
  const overflow = listings.length - shown.length;

  const bySource = new Map<string, ScrapedListing[]>();
  for (const l of shown) {
    const key = SOURCE_LABELS[l.source] ?? l.source;
    bySource.set(key, [...(bySource.get(key) ?? []), l]);
  }

  const sections = [...bySource.entries()]
    .map(
      ([label, items]) => `
      <h2 style="font-size:16px;color:#1a1a1a;border-bottom:2px solid #e8e4dc;padding-bottom:8px;margin:28px 0 4px;">
        ${label} <span style="color:#999;font-weight:normal;">(${items.length})</span>
      </h2>
      ${items.map(renderListing).join("")}`,
    )
    .join("");

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;padding:24px;background:#faf8f4;">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a8378;margin:0;">Daily Apartment Digest</p>
    <h1 style="font-size:24px;color:#1a1a1a;margin:4px 0 0;">${listings.length} new listing${listings.length === 1 ? "" : "s"}</h1>
    <p style="font-size:13px;color:#8a8378;margin:4px 0 0;">${date} · new in the last 24 hours</p>
    ${sections}
    ${overflow > 0 ? `<p style="font-size:13px;color:#8a8378;">…and ${overflow} more in the web app.</p>` : ""}
    <p style="font-size:11px;color:#b5aea2;margin-top:32px;border-top:1px solid #e8e4dc;padding-top:12px;">
      Sent by your Apartment Hunt scraper. Sources: Craigslist, Apartments.com, SeattleRentals.
    </p>
  </div>`;

  const { error } = await resend.emails.send({
    from: "Apartment Hunt <onboarding@resend.dev>",
    to,
    subject: `🏠 ${listings.length} new apartment${listings.length === 1 ? "" : "s"} — ${date}`,
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

function renderListing(l: ScrapedListing): string {
  const facts = [
    l.price != null ? `$${l.price.toLocaleString()}/mo` : null,
    l.bedrooms != null ? (l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bd`) : null,
    l.bathrooms != null ? `${l.bathrooms} ba` : null,
    l.sqft != null ? `${l.sqft.toLocaleString()} sqft` : null,
    l.neighborhood,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
  <table style="width:100%;margin:12px 0;background:#ffffff;border:1px solid #e8e4dc;border-radius:6px;" cellpadding="0" cellspacing="0">
    <tr>
      ${
        l.imageUrl
          ? `<td style="width:110px;padding:10px;vertical-align:top;">
               <img src="${l.imageUrl}" width="100" height="75" style="object-fit:cover;border-radius:4px;display:block;" alt="" />
             </td>`
          : ""
      }
      <td style="padding:10px;vertical-align:top;">
        <a href="${l.url}" style="font-size:15px;color:#1a4d8f;text-decoration:none;font-weight:bold;">${escapeHtml(l.title)}</a>
        <p style="font-size:13px;color:#555;margin:6px 0 0;">${facts}</p>
        ${l.address ? `<p style="font-size:12px;color:#999;margin:4px 0 0;">${escapeHtml(l.address)}</p>` : ""}
      </td>
    </tr>
  </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
