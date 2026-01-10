"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "@/lib/transactionActions";

export default function TransactionRowActions(props: {
  transactionId: string;
  propertyId: string;
  month: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Link
        className="ll_btnSecondary"
        href={`/properties/${props.propertyId}/ledger/${props.transactionId}/edit?month=${encodeURIComponent(
          props.month
        )}`}
      >
        Edit
      </Link>
      <button
        type="button"
        className="ll_btnSecondary"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await deleteTransaction(props.transactionId);
            router.refresh();
          });
        }}
        suppressHydrationWarning
      >
        Delete
      </button>
    </>
  );
}
