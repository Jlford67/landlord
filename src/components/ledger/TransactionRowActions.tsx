"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "@/lib/transactionActions";

export default function TransactionRowActions(props: { transactionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
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
  );

}
