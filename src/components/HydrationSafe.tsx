import { CSSProperties, ReactNode } from "react";

type HydrationSafeProps = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function HydrationSafe({ className, style, children }: HydrationSafeProps) {
  return (
    <div suppressHydrationWarning className={className} style={style}>
      {children}
    </div>
  );
}
