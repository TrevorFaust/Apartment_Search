import type { Metadata } from "next";
import { Fraunces, Libre_Franklin } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${franklin.variable} min-h-screen`}>
        <header className="rounded-b-[2.5rem] border-b border-line/70 bg-bg shadow-soft">
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
              <nav className="flex flex-wrap items-center gap-1.5 pb-1 text-sm">
                <Link href="/" className={NAV_LINK}>
                  <LinkPending>Listings</LinkPending>
                </Link>
                {viewer ? (
                  <Link href="/account" className={NAV_CTA} title={viewer.email}>
                    <LinkPending>Profile</LinkPending>
                  </Link>
                ) : (
                  <Link href="/signin" className={NAV_CTA}>
                    <LinkPending>Sign in</LinkPending>
                  </Link>
                )}
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
  "press rounded-full border border-ink/15 bg-bg-elevated/60 px-4 py-1.5 hover:border-ink hover:bg-ink hover:text-bg-elevated hover:shadow-soft";
const NAV_CTA =
  "press rounded-full bg-accent px-4 py-1.5 text-bg-elevated shadow-glow hover:bg-accent-dim";
