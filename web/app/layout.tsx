import type { Metadata } from "next";
import { Fraunces, Libre_Franklin } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const franklin = Libre_Franklin({
  subsets: ["latin"],
  variable: "--font-franklin",
});

export const metadata: Metadata = {
  title: "Apartment Hunt",
  description: "Daily-scraped apartment listings, all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${franklin.variable} min-h-screen`}>
        <header className="border-b-4 border-double border-ink/70 bg-paper">
          <div className="mx-auto max-w-5xl px-6 pt-8 pb-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-ink-soft">
              Scraped fresh, every morning
            </p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h1 className="font-display text-5xl font-semibold tracking-tight">
                The Apartment{" "}
                <span className="italic font-normal text-rust">Hunt</span>
              </h1>
              <nav className="flex gap-1 pb-1 text-sm">
                <Link
                  href="/"
                  className="border border-ink/30 px-4 py-1.5 transition-colors hover:bg-ink hover:text-paper"
                >
                  Listings
                </Link>
                <Link
                  href="/preferences"
                  className="border border-ink/30 px-4 py-1.5 transition-colors hover:bg-ink hover:text-paper"
                >
                  Preferences
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-ink-faint">
          Sources: Craigslist · Apartments.com · SeattleRentals — personal use,
          once daily, be kind to the sites.
        </footer>
      </body>
    </html>
  );
}
