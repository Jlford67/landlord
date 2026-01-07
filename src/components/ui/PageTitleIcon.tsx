import type { ReactNode } from "react";

export default function PageTitleIcon({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${className}`}>
      {children}
    </div>
  );
}
