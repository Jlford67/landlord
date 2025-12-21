import Link from "next/link";

export default function NewPropertyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0b1f3a",
        color: "#ffffff",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          background: "#122b4f",
          borderRadius: 10,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Add property</h1>
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.75)" }}>
          Enter the basics. You can add more details later.
        </div>

        <form action="/api/properties" method="post" style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Nickname (optional)</div>
            <input
              name="nickname"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "#0f2440",
                color: "#ffffff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Street</div>
            <input
              name="street"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "#0f2440",
                color: "#ffffff",
              }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>City</div>
              <input
                name="city"
                required
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "#0f2440",
                  color: "#ffffff",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>State</div>
              <input
                name="state"
                required
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "#0f2440",
                  color: "#ffffff",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>ZIP</div>
              <input
                name="zip"
                required
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "#0f2440",
                  color: "#ffffff",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <Link href="/properties" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none" }}>
              ← Back
            </Link>

            <button
              type="submit"
              style={{
                padding: "10px 14px",
                fontWeight: 800,
                background: "#1e90ff",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
