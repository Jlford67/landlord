"use client";

import * as React from "react";
import { getButtonClasses, getButtonIconClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  mountGate?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  mountGate = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const [mounted, setMounted] = React.useState(!mountGate);

  React.useEffect(() => {
    if (mountGate) setMounted(true);
  }, [mountGate]);

  const classes = getButtonClasses({ variant, size, className });
  const iconClasses = getButtonIconClasses(size);

  if (!mounted) {
    return (
      <span className={`${classes} pointer-events-none opacity-0`} aria-hidden="true">
        {leftIcon ? <span className={iconClasses}>{leftIcon}</span> : null}
        <span className="whitespace-nowrap">{children}</span>
      </span>
    );
  }

  return (
    <button suppressHydrationWarning className={classes} {...props}>
      {leftIcon ? <span className={iconClasses}>{leftIcon}</span> : null}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}
