import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, isOwner } from "@/lib/auth";
import { formatMonthDay } from "@/lib/dates";
import { getSubscriber } from "@/lib/subscribers";
import { signOut } from "./actions";
import { AlertsForm } from "./alerts-form";
import { loadAlertOptions } from "./load-options";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");

  const subscriber = await getSubscriber(viewer.id);
  if (!subscriber?.onboarded_at) redirect("/welcome");

  const [{ saved }, { cityCounts, neighborhoodOptions }] = await Promise.all([
    searchParams,
    loadAlertOptions(),
  ]);
  const str = (n: number | null) => (n == null ? "" : String(n));
  const locations =
    subscriber.locations?.length > 0
      ? subscriber.locations
      : subscriber.cities.map((city) => ({
          city,
          state: cityCounts.find((c) => c.city === city)?.state ?? "",
        }));
  const status =
    subscriber.frequency === "off"
      ? "Emails are off."
      : `You'll get a ${subscriber.frequency} email when new matches show up${
          subscriber.last_digest_at
            ? ` (checking for listings since ${formatMonthDay(subscriber.last_digest_at)})`
            : ""
        }.`;

  return (
    <div className="rise mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-brass">{viewer.email}</p>
          <h2 className="mt-2 font-display text-4xl leading-tight font-medium">
            Your <span className="italic text-brass">profile</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{status}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner(viewer) && (
            <Link
              href="/preferences"
              className="press inline-flex min-h-11 items-center border border-ink/20 bg-bg-elevated px-4 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-metal"
            >
              Scraper settings
            </Link>
          )}
          <form action={signOut}>
            <button
              suppressHydrationWarning
              type="submit"
              className="press inline-flex min-h-11 items-center border border-ink/20 bg-bg-elevated px-4 text-xs uppercase tracking-[0.14em] text-ink-soft hover:border-ink hover:bg-ink hover:text-bg-elevated"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {saved && (
        <p className="rise mt-5 border border-brass/40 bg-accent-wash px-4 py-2.5 text-sm text-brass">
          Saved. Your next email will use these picks.
        </p>
      )}

      <div className="sheet mt-6 p-7 sm:p-9">
        <AlertsForm
          from="account"
          submitLabel="Save changes"
          cityCounts={cityCounts}
          neighborhoodOptions={neighborhoodOptions}
          values={{
            locations: locations.filter((l) => l.state),
            neighborhoods: subscriber.neighborhoods,
            maxPrice: str(subscriber.max_price),
            minBeds: str(subscriber.min_beds),
            minBaths: str(subscriber.min_baths),
            minSqft: str(subscriber.min_sqft),
            frequency: subscriber.frequency,
          }}
        />
      </div>
    </div>
  );
}
