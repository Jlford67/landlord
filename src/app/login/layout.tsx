import "../globals.css";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[var(--bg)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at top, rgba(255,255,255,0.75), rgba(255,255,255,0) 60%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-md px-4 py-12">
        {children}
      </div>
    </div>
  );
}
