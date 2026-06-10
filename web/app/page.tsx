import Link from "next/link";
import { supabaseAdmin, type ListingRow } from "@/lib/supabase";
import { ListingCard } from "./listing-card";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const TABS = [
  { id: "all", label: "All" },
  { id: "new", label: "New (24h)" },
  { id: "favorites", label: "Favorites" },
  { id: "hidden", label: "Hidden" },
] as const;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : "all";
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");

  let query = supabaseAdmin()
    .from("listings")
    .select("*")
    .order("first_seen_at", { ascending: false })
    .limit(200);

  if (tab === "hidden") {
    query = query.eq("is_hidden", true);
  } else {
    query = query.eq("is_hidden", false);
    if (tab === "new") {
      query = query.gte(
        "first_seen_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );
    }
    if (tab === "favorites") query = query.eq("is_favorite", true);
  }

  if (str("min_price")) query = query.gte("price", Number(str("min_price")));
  if (str("max_price")) query = query.lte("price", Number(str("max_price")));
  if (str("beds")) query = query.gte("bedrooms", Number(str("beds")));
  if (str("neighborhood"))
    query = query.ilike("neighborhood", `%${str("neighborhood")}%`);
  if (str("source")) query = query.eq("source", str("source"));

  const { data, error } = await query;
  if (error) {
    return (
      <p className="border border-rust bg-paper-deep p-4 text-sm text-rust-deep">
        Couldn&apos;t load listings: {error.message}
      </p>
    );
  }
  const listings = (data ?? []) as ListingRow[];

  const tabHref = (id: string) => {
    const next = new URLSearchParams();
    for (const k of ["min_price", "max_price", "beds", "neighborhood", "source"]) {
      if (str(k)) next.set(k, str(k));
    }
    if (id !== "all") next.set("tab", id);
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div className="rise">
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-line pb-4">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            className={`px-4 py-1.5 text-sm transition-colors ${
              tab === t.id
                ? "bg-ink text-paper"
                : "border border-ink/20 hover:border-ink/60"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <span className="ml-auto font-display text-sm italic text-ink-soft">
          {listings.length} listing{listings.length === 1 ? "" : "s"}
        </span>
      </div>

      <form className="mb-8 grid grid-cols-2 gap-3 border border-line bg-paper-deep/60 p-4 sm:grid-cols-3 lg:grid-cols-6">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <Field label="Min $" name="min_price" defaultValue={str("min_price")} type="number" />
        <Field label="Max $" name="max_price" defaultValue={str("max_price")} type="number" />
        <Field label="Beds ≥" name="beds" defaultValue={str("beds")} type="number" />
        <Field label="Neighborhood" name="neighborhood" defaultValue={str("neighborhood")} />
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
          Source
          <select
            suppressHydrationWarning
            name="source"
            defaultValue={str("source")}
            className="border border-ink/30 bg-paper px-2 py-1.5 text-sm text-ink focus:border-rust focus:outline-none"
          >
            <option value="">All</option>
            <option value="craigslist">Craigslist</option>
            <option value="apartments_com">Apartments.com</option>
            <option value="seattle_rentals">SeattleRentals</option>
          </select>
        </label>
        <button
          suppressHydrationWarning
          type="submit"
          className="self-end border border-ink bg-ink px-4 py-1.5 text-sm text-paper transition-colors hover:bg-rust hover:border-rust"
        >
          Filter
        </button>
      </form>

      {listings.length === 0 ? (
        <div className="border border-dashed border-ink/30 p-16 text-center">
          <p className="font-display text-2xl italic text-ink-soft">
            Nothing here yet.
          </p>
          <p className="mt-2 text-sm text-ink-faint">
            Run the scraper (<code>npm run scrape</code>) or wait for the next
            daily run.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
      {label}
      <input
        suppressHydrationWarning
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="border border-ink/30 bg-paper px-2 py-1.5 text-sm text-ink focus:border-rust focus:outline-none"
      />
    </label>
  );
}
