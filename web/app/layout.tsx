import type { Metadata } from "next";
import { Fraunces, Libre_Franklin } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { LinkPending } from "./link-pending";
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
  title: "Lease Locator",
  description: "Daily-scraped apartment listings, all in one place.",
  applicationName: "Lease Locator",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${franklin.variable} min-h-screen`}>
        <header className="border-b-4 border-double border-ink/70 bg-bg">
          <div className="mx-auto max-w-5xl px-6 pt-6 pb-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-accent">
              Scraped fresh, every morning
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h1 className="m-0">
                <Link
                  href="/"
                  aria-label="Lease Locator home"
                  className="inline-block transition-transform duration-300 ease-out-soft hover:-rotate-1 hover:scale-[1.02]"
                >
                  <Image
                    src="/logo.png"
                    alt="Lease Locator"
                    width={583}
                    height={311}
                    className="h-20 w-auto brightness-[1.03] sm:h-28"
                    priority
                  />
                </Link>
              </h1>
              <nav className="flex gap-1.5 pb-1 text-sm">
                <Link href="/" className={NAV_LINK}>
                  <LinkPending>Listings</LinkPending>
                </Link>
                <Link href="/preferences" className={NAV_LINK}>
                  <LinkPending>Preferences</LinkPending>
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-ink-faint">
          Sources: Craigslist · Apartments.com · SeattleRentals · Chicago
          sites — personal use, once daily, be kind to the sites.
        </footer>
      </body>
    </html>
  );
}

const NAV_LINK =
  "press border border-ink/30 px-4 py-1.5 hover:border-ink hover:bg-ink hover:text-bg-elevated hover:shadow-[3px_3px_0_0_var(--color-accent)]";
