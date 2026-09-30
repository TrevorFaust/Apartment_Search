import type { Metadata } from "next";
import { Bodoni_Moda, Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { LinkPending } from "./link-pending";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
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
      <body className={`${bodoni.variable} ${outfit.variable} min-h-screen`}>
        <a
          href="#listings"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-bg-elevated"
        >
          Skip to listings
        </a>
        <header>
          <div className="bg-ink text-bg-elevated">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5">
              <p className="text-xs uppercase tracking-[0.32em] text-metal">
                Scraped fresh, every morning
              </p>
              <nav className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em]">
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
          <div className="h-0.5 bg-metal" />
          <div className="border-b border-ink/15">
            <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-8 text-center sm:py-10">
              <h1 className="m-0">
                <Link
                  href="/"
                  aria-label="Lease Locator home"
                  className="inline-block transition-opacity duration-300 hover:opacity-80"
                >
                  <Image
                    src="/logo-mark.png"
                    alt="Lease Locator"
                    width={583}
                    height={311}
                    className="h-28 w-auto sm:h-40"
                    priority
                  />
                </Link>
              </h1>
              <p className="mt-4 font-display text-4xl leading-[0.95] font-medium text-ink sm:text-5xl">
                Places worth <span className="italic text-brass">a second look.</span>
              </p>
            </div>
          </div>
        </header>
        <main id="listings" className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl border-t border-ink/15 px-6 py-8 text-xs uppercase tracking-[0.16em] text-ink-faint">
          Craigslist · Apartments.com · SeattleRentals · Chicago sites
          <span className="mt-2 block normal-case tracking-normal">
            Personal use, once daily. Be kind to the sites.
          </span>
        </footer>
      </body>
    </html>
  );
}

const NAV_LINK =
  "press inline-flex min-h-11 items-center px-3 text-bg-elevated/80 hover:text-metal";
const NAV_CTA =
  "press inline-flex min-h-11 items-center bg-metal px-4 text-ink hover:bg-bg-elevated";
