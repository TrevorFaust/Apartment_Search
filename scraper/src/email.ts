import { Resend } from "resend";
import type { ScrapedListing } from "./types.js";

const SOURCE_LABELS: Record<string, string> = {
  craigslist: "Craigslist",
  apartments_com: "Apartments.com",
  seattle_rentals: "SeattleRentals",
  chicago_rentals: "ChicagoRentals",
  chicago_apartment_finders: "ChicagoApartmentFinders",
  urban_abodes: "UrbanAbodes",
  domu: "Domu",
};

const MAX_LISTINGS_IN_EMAIL = 50;
const DEFAULT_FROM = "Lease Locator <onboarding@resend.dev>";

export type EmailListing = Pick<
  ScrapedListing,
  | "source"
  | "url"
  | "title"
  | "price"
  | "bedrooms"
  | "bathrooms"
  | "sqft"
  | "neighborhood"
  | "address"
  | "imageUrl"
>;

export async function sendNewsletter(
  listings: EmailListing[],
  to: string,
): Promise<void> {
  await sendListingsEmail({
    to,
    listings,
    kicker: "Daily Apartment Digest",
    subtitle: "new in the last 24 hours",
  });
}

export async function sendListingsEmail({
  to,
  listings,
  kicker,
  subtitle,
  manageUrl,
  unsubscribeUrl,
}: {
  to: string;
  listings: EmailListing[];
  kicker: string;
  subtitle: string;
  manageUrl?: string;
  unsubscribeUrl?: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const shown = listings.slice(0, MAX_LISTINGS_IN_EMAIL);
  const overflow = listings.length - shown.length;

  const bySource = new Map<string, EmailListing[]>();
  for (const l of shown) {
    const key = SOURCE_LABELS[l.source] ?? l.source;
    bySource.set(key, [...(bySource.get(key) ?? []), l]);
  }

  const sections = [...bySource.entries()]
    .map(
      ([label, items]) => `
      <h2 style="font-size:15px;color:#1a1c18;margin:28px 0 4px;font-weight:600;">
        ${label} <span style="color:#6f7468;font-weight:normal;">(${items.length})</span>
      </h2>
      ${items.map(renderListing).join("")}`,
    )
    .join("");

  const links = [
    manageUrl ? `<a href="${manageUrl}" style="color:#3d6f5f;">Edit your alerts</a>` : "",
    unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#3d6f5f;">Unsubscribe</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;padding:28px;background:#e6e3db;border-radius:24px;">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#3d6f5f;margin:0;">${kicker}</p>
    <h1 style="font-size:24px;color:#1a1c18;margin:6px 0 0;">${listings.length} new listing${listings.length === 1 ? "" : "s"}</h1>
    <p style="font-size:13px;color:#6f7468;margin:4px 0 0;">${date} · ${subtitle}</p>
    ${sections}
    ${overflow > 0 ? `<p style="font-size:13px;color:#6f7468;">…and ${overflow} more on the site.</p>` : ""}
    <p style="font-size:11px;color:#6f7468;margin-top:32px;border-top:1px solid #cfc9bc;padding-top:12px;">
      Sent by Lease Locator.${links ? ` ${links}` : ""}
    </p>
  </div>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    to,
    subject: `🏠 ${listings.length} new apartment${listings.length === 1 ? "" : "s"} — ${date}`,
    html,
    ...(unsubscribeUrl
      ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } }
      : {}),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

function renderListing(l: EmailListing): string {
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
  <table style="width:100%;margin:12px 0;background:#efece5;border-radius:18px;" cellpadding="0" cellspacing="0">
    <tr>
      ${
        l.imageUrl
          ? `<td style="width:116px;padding:10px;vertical-align:top;">
               <img src="${l.imageUrl}" width="104" height="78" style="object-fit:cover;border-radius:12px;display:block;" alt="" />
             </td>`
          : ""
      }
      <td style="padding:12px;vertical-align:top;">
        <a href="${l.url}" style="font-size:15px;color:#2f5649;text-decoration:none;font-weight:bold;">${escapeHtml(l.title)}</a>
        <p style="font-size:13px;color:#4a4e45;margin:6px 0 0;">${escapeHtml(facts)}</p>
        ${l.address ? `<p style="font-size:12px;color:#6f7468;margin:4px 0 0;">${escapeHtml(l.address)}</p>` : ""}
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
