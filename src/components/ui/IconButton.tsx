import type { ReactNode } from "react";

export default function IconButton({
  icon,
  ariaLabel,
  title,
  type = "button",
  className = "",
}: {
  icon: ReactNode;
  ariaLabel: string;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button className={className} type={type} aria-label={ariaLabel} title={title}>
      {icon}
    </button>
  );
}
