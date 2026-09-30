import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { DEFAULT_CRITERIA, getSubscriber } from "@/lib/subscribers";
import { AlertsForm } from "../account/alerts-form";
import { loadAlertOptions } from "../account/load-options";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");
  if ((await getSubscriber(viewer.id))?.onboarded_at) redirect("/account");

  const { cityCounts, neighborhoodOptions } = await loadAlertOptions();

  return (
    <div className="rise mx-auto max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Welcome</p>
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
        What are you <span className="font-normal italic text-accent">looking for?</span>
      </h2>
      <p className="mt-2 mb-8 text-sm text-ink-soft">
        Type the city you&apos;re moving to. We&apos;ve picked the most popular
        choices for the rest; tap anything that doesn&apos;t fit. You can fine-tune
        exact numbers later in your profile.
      </p>
      <div className="rounded-[2rem] border border-line/70 bg-bg-elevated p-7 shadow-lift sm:p-9">
        <AlertsForm
          from="welcome"
          submitLabel="Save & show my matches"
          cityCounts={cityCounts}
          neighborhoodOptions={neighborhoodOptions}
          values={{
            locations: [],
            neighborhoods: [],
            maxPrice: DEFAULT_CRITERIA.maxPrice,
            minBeds: DEFAULT_CRITERIA.minBeds,
            minBaths: DEFAULT_CRITERIA.minBaths,
            minSqft: DEFAULT_CRITERIA.minSqft,
            frequency: DEFAULT_CRITERIA.frequency,
          }}
        />
      </div>
    </div>
  );
}
