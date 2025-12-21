"use client";

import { useEffect, useState } from "react";

export default function LoginFormClient() {
  // Wait until after mount so extensions like LastPass can do their DOM mutations
  // before React renders anything. This avoids hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Sign in</h1>

      <form action="/api/auth/login" method="post" style={{ display: "grid", gap: 12 }}>
        <label>
          <div>Email</div>
          <input name="email" type="email" required style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          <div>Password</div>
          <input name="password" type="password" required style={{ width: "100%", padding: 8 }} />
        </label>

        <button type="submit" style={{ padding: 10, fontWeight: 600 }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
