"use client";

import { useEffect, useState } from "react";

export default function LoginFormClient() {
  // Wait until after mount so extensions like LastPass can do their DOM mutations
  // before React renders anything. This avoids hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div aria-hidden="true" className="space-y-4">
        <div className="h-4 w-20 rounded bg-gray-100" />
        <div className="h-11 w-full rounded-lg bg-gray-100" />
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-11 w-full rounded-lg bg-gray-100" />
        <div className="h-11 w-full rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div>
      <form action="/api/auth/login" method="post" className="ll_form">
        <label className="ll_label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="ll_input"
          autoComplete="email"
          suppressHydrationWarning
        />

        <label className="ll_label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="ll_input"
          autoComplete="current-password"
          suppressHydrationWarning
        />

        <div className="mt-4">
          <button type="submit" className="ll_btnPrimary w-full" suppressHydrationWarning>
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}
