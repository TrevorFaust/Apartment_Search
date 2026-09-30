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
    <div className="sheet rise mx-auto max-w-md p-8 text-center">
      {done ? (
        <>
          <h2 className="font-display text-3xl font-medium">You&apos;re unsubscribed</h2>
          <p className="mt-2 text-sm text-ink-soft">
            No more alert emails. You can turn them back on from your Profile anytime.
          </p>
        </>
      ) : typeof token === "string" ? (
        <form action={unsubscribe} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <h2 className="font-display text-3xl font-medium">Stop alert emails?</h2>
          <p className="text-sm text-ink-soft">
            You&apos;ll stop getting new-apartment emails from Lease Locator.
          </p>
          <button
            suppressHydrationWarning
            type="submit"
            className="press w-full min-h-11 bg-ink py-3 text-xs uppercase tracking-[0.16em] text-metal hover:bg-metal hover:text-ink"
          >
            Unsubscribe
          </button>
        </form>
      ) : (
        <p className="text-sm text-ink-soft">This unsubscribe link is missing its token.</p>
      )}
      <Link
        href="/"
        className="mt-5 inline-block text-sm text-brass underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        Back to listings
      </Link>
    </div>
  );
}
