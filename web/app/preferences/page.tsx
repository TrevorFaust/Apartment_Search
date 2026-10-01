import { redirect } from "next/navigation";
import { getViewer, isOwner } from "@/lib/auth";
import { supabaseAdmin, normalizeLocations, type PreferencesRow } from "@/lib/supabase";
import { savePreferences } from "../actions";
import { AmountInput } from "../amount-input";
import { LocationsEditor } from "../locations-editor";
import { MultiSelectFilter } from "../multi-select-filter";
import { titleCase } from "@/lib/sources";
import {
  applyListingFilters,
  fetchDistinctNeighborhoods,
  parseFilters,
} from "@/lib/listings-query";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const viewer = await getViewer();
  if (!isOwner(viewer)) redirect(viewer ? "/account" : "/signin");

  const { data, error } = await supabaseAdmin()
    .from("preferences")
    .select("*")
    .eq("key", "default")
    .single();

  if (error) {
    return (
      <p className="border border-ink/20 bg-bg-deep p-4 text-sm text-ink">
        Couldn&apos;t load preferences: {error.message}
      </p>
    );
  }
  const prefs = data as PreferencesRow;
  const locations = normalizeLocations(prefs);
  const cities = locations.map((l) => l.city);

  let neighborhoodOptions: Awaited<
    ReturnType<typeof fetchDistinctNeighborhoods>
  > = [];
  try {
    const buildFacetQuery = () =>
      applyListingFilters(
        supabaseAdmin().from("listings"),
        parseFilters({ city: cities }),
        {
          includeCityFilter: true,
          includeNeighborhoodFilter: false,
          includeFreshnessFilter: false,
          select: "id",
        },
      );
    neighborhoodOptions = await fetchDistinctNeighborhoods(
      buildFacetQuery,
      cities,
    );
  } catch (err) {
    console.error("Failed to load neighborhood options:", err);
    neighborhoodOptions = [];
  }

  const selectedNeighborhoods = prefs.neighborhoods.map((value) => {
    if (value.includes(":")) return value;
    const match = neighborhoodOptions.find(
      (option) =>
        option.value === value || option.value.endsWith(`:${value}`),
    );
    return match?.value ?? value;
  });

  return (
    <div className="rise mx-auto max-w-2xl">
      <h2 className="font-display text-4xl font-medium">
        Search <span className="italic text-brass">settings</span>
      </h2>
      <p className="mt-1 mb-8 text-sm text-ink-soft">
        These set where the morning search looks, the radius, and your
        newsletter. For your own email alerts, use your Profile.
      </p>

      <form
        action={savePreferences}
        className="sheet space-y-6 p-7"
      >
        <Section title="Where">
          <LocationsEditor initialLocations={locations} />
        </Section>

        <Section title="Radius">
          <Field
            label="Radius (miles)"
            name="radius_miles"
            amount="decimal"
            defaultValue={prefs.radius_miles ?? ""}
            hint="Distance from downtown of each search city. Blank = no limit. Re-save after changing cities."
          />
          {prefs.radius_miles != null &&
            locations.some((l) => l.center_lat != null && l.center_lng != null) && (
              <ul className="mt-2 space-y-1 text-[10px] text-ink-faint">
                {locations
                  .filter((l) => l.center_lat != null && l.center_lng != null)
                  .map((l) => (
                    <li key={`${l.city}-${l.state}`}>
                      {titleCase(l.city)}, {l.state.toUpperCase()} center:{" "}
                      {l.center_lat!.toFixed(4)}, {l.center_lng!.toFixed(4)}
                    </li>
                  ))}
              </ul>
            )}
        </Section>

        <Section title="Neighborhoods (newsletter)">
          <MultiSelectFilter
            name="neighborhoods"
            label="Include only these neighborhoods"
            options={neighborhoodOptions}
            selected={selectedNeighborhoods}
            emptyLabel="Any neighborhood"
          />
          <p className="mt-2 text-[10px] normal-case tracking-normal text-ink-faint">
            Options come from listings already found in your cities. Blank
            selection = anywhere.
          </p>
        </Section>

        <Section title="Budget & size">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Min rent $" name="min_price" amount="whole" defaultValue={prefs.min_price ?? ""} />
            <Field label="Max rent $" name="max_price" amount="whole" defaultValue={prefs.max_price ?? ""} />
            <Field label="Min sqft" name="min_sqft" amount="whole" defaultValue={prefs.min_sqft ?? ""} />
            <Field label="Min beds" name="min_beds" amount="whole" defaultValue={prefs.min_beds ?? ""} hint="0 = studio ok" />
            <Field label="Min baths" name="min_baths" amount="decimal" defaultValue={prefs.min_baths ?? ""} />
          </div>
        </Section>

        <Section title="Must-haves">
          <Field
            label="Keywords"
            name="keywords"
            defaultValue={prefs.keywords.join(", ")}
            hint="comma-separated, matched against title + amenities (e.g. dishwasher, ac, parking). Blank = no keyword filter."
          />
        </Section>

        <Section title="Newsletter">
          <Field
            label="Email to"
            name="email_to"
            type="email"
            defaultValue={prefs.email_to ?? ""}
            hint="where the daily digest goes (overrides the EMAIL_TO env var)"
          />
        </Section>

        <button
          suppressHydrationWarning
          type="submit"
          className="press w-full min-h-11 bg-ink py-3 text-xs uppercase tracking-[0.2em] text-metal hover:bg-metal hover:text-ink"
        >
          Save preferences
        </button>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 w-full border-b border-metal/50 pb-1 font-display text-lg italic text-brass">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  type = "text",
  amount,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  hint?: string;
  type?: string;
  /** Typed-only, non-negative number box. */
  amount?: "whole" | "decimal";
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.16em] text-brass">
      {label}
      {amount ? (
        <AmountInput
          name={name}
          defaultValue={String(defaultValue)}
          decimals={amount === "decimal"}
          className="field-control normal-case tracking-normal"
        />
      ) : (
        <input
          suppressHydrationWarning
          name={name}
          type={type}
          defaultValue={defaultValue}
          className="field-control normal-case tracking-normal"
        />
      )}
      {hint && (
        <span className="text-[10px] normal-case tracking-normal text-ink-faint">
          {hint}
        </span>
      )}
    </label>
  );
}
