import type { NeighborhoodOption } from "@/lib/neighborhoods";
import { titleCase } from "@/lib/sources";
import {
  BATH_CHOICES,
  BED_CHOICES,
  BUDGET_CHOICES,
  FREQUENCY_CHOICES,
  SIZE_CHOICES,
  type Choice,
  type Frequency,
} from "@/lib/subscribers";
import { MultiSelectFilter } from "../multi-select-filter";
import { saveAlerts } from "./actions";

export type AlertValues = {
  cities: string[];
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
  cityCounts: Array<{ city: string; count: number }>;
  neighborhoodOptions: NeighborhoodOption[];
  submitLabel: string;
}) {
  const cityChoices = [...cityCounts]
    .sort((a, b) => a.city.localeCompare(b.city))
    .map(({ city, count }) => ({
      value: city,
      label: `${titleCase(city)} · ${count.toLocaleString()} listings`,
    }));

  return (
    <form action={saveAlerts} className="space-y-7">
      <input type="hidden" name="from" value={from} />

      <Step title="Where do you want to live?" hint="Pick none to hear about every city.">
        <Chips type="checkbox" name="cities" choices={cityChoices} selected={values.cities} />
        <div className="mt-3 max-w-sm">
          <MultiSelectFilter
            name="neighborhoods"
            label="Neighborhoods (optional)"
            options={neighborhoodOptions}
            selected={values.neighborhoods}
            emptyLabel="Anywhere in those cities"
          />
        </div>
      </Step>

      <Step title="Rent up to">
        <Chips type="radio" name="max_price" choices={BUDGET_CHOICES} selected={[values.maxPrice]} />
      </Step>

      <Step title="Bedrooms">
        <Chips type="radio" name="min_beds" choices={BED_CHOICES} selected={[values.minBeds]} />
      </Step>

      <div className="grid gap-7 sm:grid-cols-2">
        <Step title="Bathrooms">
          <Chips type="radio" name="min_baths" choices={BATH_CHOICES} selected={[values.minBaths]} />
        </Step>
        <Step title="Size">
          <Chips type="radio" name="min_sqft" choices={SIZE_CHOICES} selected={[values.minSqft]} />
        </Step>
      </div>

      <Step
        title="Email me new matches"
        hint="Only apartments that show up after your last email. Nothing you've already seen."
      >
        <Chips type="radio" name="frequency" choices={FREQUENCY_CHOICES} selected={[values.frequency]} />
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

function Chips({
  type,
  name,
  choices,
  selected,
}: {
  type: "radio" | "checkbox";
  name: string;
  choices: Choice[];
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => (
        <label
          key={c.value || "none"}
          className="press select-none rounded-full border border-ink/15 bg-bg px-4 py-2 text-sm text-ink-soft hover:border-accent/50 hover:bg-accent-wash hover:text-accent-dim has-checked:border-accent has-checked:bg-accent has-checked:text-bg-elevated has-checked:shadow-glow has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
        >
          <input
            type={type}
            name={name}
            value={c.value}
            defaultChecked={selected.includes(c.value)}
            className="sr-only"
          />
          {c.label}
        </label>
      ))}
    </div>
  );
}
