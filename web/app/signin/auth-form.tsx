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

      <div className="grid grid-cols-2 border border-ink/20 bg-bg">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            suppressHydrationWarning
            onClick={() => setMode(m)}
            aria-pressed={activeMode === m}
            className={`press min-h-11 py-2 text-xs uppercase tracking-[0.14em] ${
              activeMode === m
                ? "bg-ink text-metal"
                : "text-ink-soft hover:bg-accent-wash hover:text-ink"
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
        <p role="alert" className="border border-brass/50 bg-accent-wash px-4 py-2.5 text-sm text-brass">
          {state.error}
        </p>
      )}

      <button
        suppressHydrationWarning
        type="submit"
        disabled={pending}
        className="press w-full min-h-11 bg-ink py-3 text-xs uppercase tracking-[0.18em] text-metal hover:bg-metal hover:text-ink disabled:opacity-60"
      >
        {pending ? "One sec…" : isSignup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
