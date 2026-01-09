"use client";

import * as React from "react";

const SafeButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ suppressHydrationWarning, ...props }, ref) => (
    <button ref={ref} suppressHydrationWarning {...props} />
  )
);

SafeButton.displayName = "SafeButton";

export default SafeButton;
