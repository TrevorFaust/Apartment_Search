import type { NeighborhoodOption } from "@/lib/neighborhoods";
import {
  BATH_CHOICES,
  BED_CHOICES,
  BUDGET_CHOICES,
  FREQUENCY_CHOICES,
  SIZE_CHOICES,
  type AlertLocation,
  type CityCount,
  type Frequency,
} from "@/lib/subscribers";
import { saveAlerts } from "./actions";
import { ChoiceField } from "./choice-field";
import { CityPicker } from "./city-picker";

export type AlertValues = {
  locations: AlertLocation[];
  neighborhoods: string[];
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  minSqft: string;
  frequency: Frequency;
};

export function AlertsForm({
  from,
  values,
  cityCounts,
  neighborhoodOptions,
  submitLabel,
}: {
  from: "welcome" | "account";
  values: AlertValues;
  cityCounts: CityCount[];
  neighborhoodOptions: NeighborhoodOption[];
  submitLabel: string;
}) {
  // Onboarding keeps it to quick taps; the profile page also takes exact numbers.
  const exact = from === "account";

  return (
    <form action={saveAlerts} className="space-y-7">
      <input type="hidden" name="from" value={from} />

      <Step
        title="Where do you want to live?"
        hint="Any US city. New ones get added to the next morning's search. Leave it empty to hear about every city."
      >
        <CityPicker
          initial={values.locations}
          covered={cityCounts}
          neighborhoodOptions={neighborhoodOptions}
          selectedNeighborhoods={values.neighborhoods}
        />
      </Step>

      <Step title="Rent up to">
        <ChoiceField
          name="max_price"
          choices={BUDGET_CHOICES}
          defaultValue={values.maxPrice}
          exact={exact ? { label: "Exact", prefix: "$", step: 50, max: 50000 } : undefined}
        />
      </Step>

      <Step title="Bedrooms">
        <ChoiceField
          name="min_beds"
          choices={BED_CHOICES}
          defaultValue={values.minBeds}
          exact={exact ? { label: "At least", suffix: "beds", max: 10 } : undefined}
        />
      </Step>

      <Step title="Bathrooms">
        <ChoiceField
          name="min_baths"
          choices={BATH_CHOICES}
          defaultValue={values.minBaths}
          exact={exact ? { label: "At least", suffix: "baths", step: 0.5, max: 10 } : undefined}
        />
      </Step>

      <Step title="Size">
        <ChoiceField
          name="min_sqft"
          choices={SIZE_CHOICES}
          defaultValue={values.minSqft}
          exact={exact ? { label: "At least", suffix: "sqft", step: 25, max: 20000 } : undefined}
        />
      </Step>

      <Step
        title="Email me new matches"
        hint="Only apartments that show up after your last email. Nothing you've already seen."
      >
        <ChoiceField name="frequency" choices={FREQUENCY_CHOICES} defaultValue={values.frequency} />
      </Step>

      <button
        suppressHydrationWarning
        type="submit"
        className="press w-full rounded-full bg-accent py-3.5 text-sm font-medium text-bg-elevated shadow-glow hover:bg-accent-dim"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="font-display text-lg">{title}</legend>
      {hint && <p className="mb-2 text-xs text-ink-faint">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </fieldset>
  );
}
