"use client";

import * as React from "react";

type SafeButtonVariant = "primary" | "outline" | "warning" | "danger" | "link";
type SafeButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SafeButtonVariant;
  size?: SafeButtonSize;
};

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

const variantClass: Record<SafeButtonVariant, string> = {
  primary: "ll_btnPrimary",
  outline: "ll_btnOutline",
  warning: "ll_btnWarning",
  danger: "ll_btnDanger",
  link: "ll_btnLink",
};

// Only add size classes if your design system defines them.
// If not, this safely becomes a no-op.
const sizeClass: Partial<Record<SafeButtonSize, string>> = {
  sm: "ll_btnSm",
  md: "ll_btnMd",
  lg: "ll_btnLg",
};

const SafeButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, suppressHydrationWarning, ...props }, ref) => (
    <button
      ref={ref}
      suppressHydrationWarning
      className={cx(
        "ll_btn",
        variant ? variantClass[variant] : undefined,
        size ? sizeClass[size] : undefined,
        className
      )}
      {...props}
    />
  )
);

SafeButton.displayName = "SafeButton";

export default SafeButton;
