import { supabaseAdmin, type PreferencesRow } from "@/lib/supabase";
import { savePreferences } from "../actions";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const { data, error } = await supabaseAdmin()
    .from("preferences")
    .select("*")
    .eq("key", "default")
    .single();

  if (error) {
    return (
      <p className="border border-rust bg-paper-deep p-4 text-sm text-rust-deep">
        Couldn&apos;t load preferences: {error.message}
      </p>
    );
  }
  const prefs = data as PreferencesRow;

  return (
    <div className="rise mx-auto max-w-2xl">
      <h2 className="font-display text-3xl font-semibold">
        Search <span className="italic font-normal text-rust">preferences</span>
      </h2>
      <p className="mt-1 mb-8 text-sm text-ink-soft">
        These drive both the scraper&apos;s search filters and which new
        listings make it into your daily newsletter.
      </p>

      <form
        action={savePreferences}
        className="space-y-6 border border-line bg-paper p-6 shadow-[4px_4px_0_0_var(--color-line)]"
      >
        <Section title="Where">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="City"
              name="city"
              defaultValue={prefs.city}
              hint="e.g. seattle (used for Craigslist subdomain + Apartments.com URL)"
            />
            <Field
              label="Neighborhoods"
              name="neighborhoods"
              defaultValue={prefs.neighborhoods.join(", ")}
              hint="comma-separated, blank = anywhere"
            />
          </div>
        </Section>

        <Section title="Budget & size">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Min rent $" name="min_price" type="number" defaultValue={prefs.min_price ?? ""} />
            <Field label="Max rent $" name="max_price" type="number" defaultValue={prefs.max_price ?? ""} />
            <Field label="Min sqft" name="min_sqft" type="number" defaultValue={prefs.min_sqft ?? ""} />
            <Field label="Min beds" name="min_beds" type="number" step="1" defaultValue={prefs.min_beds ?? ""} hint="0 = studio ok" />
            <Field label="Max beds" name="max_beds" type="number" step="1" defaultValue={prefs.max_beds ?? ""} />
            <Field label="Min baths" name="min_baths" type="number" step="0.5" defaultValue={prefs.min_baths ?? ""} />
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
          className="w-full border border-ink bg-ink py-2.5 text-sm uppercase tracking-[0.2em] text-paper transition-colors hover:border-rust hover:bg-rust"
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
      <legend className="mb-3 border-b border-line pb-1 font-display text-lg italic text-ink-soft w-full">
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
  step,
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  hint?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
      {label}
      <input
        suppressHydrationWarning
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        className="border border-ink/30 bg-paper px-2 py-1.5 text-sm normal-case tracking-normal text-ink focus:border-rust focus:outline-none"
      />
      {hint && (
        <span className="text-[10px] normal-case tracking-normal text-ink-faint">
          {hint}
        </span>
      )}
    </label>
  );
}
