"use client";

import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "../account/actions";

const INITIAL: AuthState = { error: null, mode: "signup", email: "" };

export function AuthForm() {
  const [state, action, pending] = useActionState(authenticate, INITIAL);
  const [activeMode, setMode] = useState<AuthState["mode"]>(INITIAL.mode);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    // "Email already registered" flips the form to sign-in.
    setSeenState(state);
    setMode(state.mode);
  }
  const isSignup = activeMode === "signup";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={activeMode} />

      <div className="grid grid-cols-2 gap-1 rounded-full border border-line/70 bg-bg p-1">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            suppressHydrationWarning
            onClick={() => setMode(m)}
            aria-pressed={activeMode === m}
            className={`press rounded-full py-2 text-sm ${
              activeMode === m
                ? "bg-ink text-bg-elevated shadow-soft"
                : "text-ink-soft hover:bg-accent-wash hover:text-accent-dim"
            }`}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
        <span className="pl-1">Email</span>
        <input
          suppressHydrationWarning
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className="field-control normal-case tracking-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-soft">
        <span className="pl-1">Password</span>
        <input
          suppressHydrationWarning
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="field-control normal-case tracking-normal"
        />
        {isSignup && (
          <span className="pl-1 normal-case tracking-normal text-ink-faint">
            At least 8 characters.
          </span>
        )}
      </label>

      {state.error && (
        <p role="alert" className="rounded-2xl bg-accent-wash px-4 py-2.5 text-sm text-accent-dim">
          {state.error}
        </p>
      )}

      <button
        suppressHydrationWarning
        type="submit"
        disabled={pending}
        className="press w-full rounded-full bg-accent py-3 text-sm font-medium text-bg-elevated shadow-glow hover:bg-accent-dim disabled:opacity-60"
      >
        {pending ? "One sec…" : isSignup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
