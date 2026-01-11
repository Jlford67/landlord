"use client";

import * as React from "react";

const HydrationSafeButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ suppressHydrationWarning, ...props }, ref) => (
  <button ref={ref} suppressHydrationWarning {...props} />
));

HydrationSafeButton.displayName = "HydrationSafeButton";

export default HydrationSafeButton;
