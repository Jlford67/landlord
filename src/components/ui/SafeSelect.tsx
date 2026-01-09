"use client";

import * as React from "react";

const SafeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ suppressHydrationWarning, ...props }, ref) => (
    <select ref={ref} suppressHydrationWarning {...props} />
  )
);

SafeSelect.displayName = "SafeSelect";

export default SafeSelect;
