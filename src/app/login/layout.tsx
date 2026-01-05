import "../globals.css";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-12">
        <div className="ll_card">
          <div className="ll_cardInner">{children}</div>
        </div>
      </div>
    </div>
  );
}
