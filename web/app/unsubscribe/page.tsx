import Link from "next/link";
import { unsubscribe } from "../account/actions";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, done } = await searchParams;

  return (
    <div className="rise mx-auto max-w-md rounded-[2rem] border border-line/70 bg-bg-elevated p-8 text-center shadow-lift">
      {done ? (
        <>
          <h2 className="font-display text-2xl font-semibold">You&apos;re unsubscribed</h2>
          <p className="mt-2 text-sm text-ink-soft">
            No more alert emails. You can turn them back on from My alerts anytime.
          </p>
        </>
      ) : typeof token === "string" ? (
        <form action={unsubscribe} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <h2 className="font-display text-2xl font-semibold">Stop alert emails?</h2>
          <p className="text-sm text-ink-soft">
            You&apos;ll stop getting new-apartment emails from Lease Locator.
          </p>
          <button
            suppressHydrationWarning
            type="submit"
            className="press w-full rounded-full bg-ink py-3 text-sm text-bg-elevated shadow-soft hover:bg-accent hover:shadow-glow"
          >
            Unsubscribe
          </button>
        </form>
      ) : (
        <p className="text-sm text-ink-soft">This unsubscribe link is missing its token.</p>
      )}
      <Link
        href="/"
        className="mt-5 inline-block text-sm text-accent underline-offset-2 transition-colors hover:text-accent-dim hover:underline"
      >
        Back to listings
      </Link>
    </div>
  );
}
