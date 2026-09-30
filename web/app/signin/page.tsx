import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getViewer()) redirect("/account");

  return (
    <div className="rise mx-auto max-w-md">
      <div className="sheet p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-brass">Optional</p>
        <h2 className="mt-2 font-display text-4xl leading-tight font-medium">
          Get new apartments <span className="italic text-brass">in your inbox</span>
        </h2>
        <p className="mt-2 mb-6 text-sm text-ink-soft">
          Browsing never needs an account. Sign in to get a daily or weekly email
          with only the listings that are new since your last one and match what
          you&apos;re after.
        </p>
        <AuthForm />
      </div>
    </div>
  );
}
