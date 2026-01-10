"use client";

import { useEffect, useState } from "react";

type MonthInputClientProps = {
  name: string;
  initialValue: string;
  className?: string;
};

export default function MonthInputClient({ name, initialValue, className }: MonthInputClientProps) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <input
      type="month"
      name={name}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      className={className}
    />
  );
}
