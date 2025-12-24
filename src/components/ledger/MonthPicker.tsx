"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  propertyId: string;
  month: string;
  monthOptions: string[];
};

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const mm = Number(m);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mm - 1]} ${y}`;
}

function adjacentMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function MonthPicker({ propertyId, month, monthOptions }: Props) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(month);

  const goToMonth = useCallback(
    (target: string) => {
      setSelectedMonth(target);
      router.push(`/properties/${propertyId}/ledger?month=${target}`);
    },
    [propertyId, router]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      goToMonth(selectedMonth);
    },
    [goToMonth, selectedMonth]
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(event.target.value);
  }, []);

  const prevMonth = adjacentMonth(month, -1);
  const nextMonth = adjacentMonth(month, 1);

  return (
    <div>
      <div className="ll_muted">Month</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${prevMonth}`}>
          Last month
        </Link>
        <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${nextMonth}`}>
          Next month
        </Link>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <select name="month" className="ll_input" value={selectedMonth} onChange={handleChange}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button className="ll_btnSecondary" type="submit">
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
