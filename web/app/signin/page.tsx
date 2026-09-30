import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getViewer()) redirect("/account");

  return (
    <div className="rise mx-auto max-w-md">
      <div className="rounded-[2rem] border border-line/70 bg-bg-elevated p-8 shadow-lift">
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Optional</p>
        <h2 className="mt-2 font-display text-3xl font-semibold leading-tight">
          Get new apartments <span className="font-normal italic text-accent">in your inbox</span>
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
