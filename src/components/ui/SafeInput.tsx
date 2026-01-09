"use client";

import * as React from "react";

const SafeInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ suppressHydrationWarning, ...props }, ref) => (
    <input ref={ref} suppressHydrationWarning {...props} />
  )
);

SafeInput.displayName = "SafeInput";

export default SafeInput;
