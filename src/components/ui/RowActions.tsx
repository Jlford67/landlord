"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";

export default function RowActions({
  editHref,
  deleteAction,
  deleteConfirmText = "Delete this item?",
  ariaLabelEdit = "Edit",
  ariaLabelDelete = "Delete",
}: {
  editHref: string;
  deleteAction?: (formData: FormData) => Promise<void>;
  deleteConfirmText?: string;
  ariaLabelEdit?: string;
  ariaLabelDelete?: string;
}) {
  const onDeleteSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (!deleteConfirmText) return;
      if (!window.confirm(deleteConfirmText)) {
        event.preventDefault();
      }
    },
    [deleteConfirmText]
  );

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        className="ll_btn ll_btnLink"
        href={editHref}
        aria-label={ariaLabelEdit}
        style={{ padding: "4px 6px" }}
      >
        <Pencil size={18} className="text-blue-600" />
      </Link>
      {deleteAction ? (
        <form action={deleteAction} onSubmit={onDeleteSubmit}>
          <button
            className="ll_btn ll_btnLink"
            type="submit"
            aria-label={ariaLabelDelete}
            style={{ padding: "4px 6px" }}
          >
            <Trash2 size={18} className="text-blue-600" />
          </button>
        </form>
      ) : null}
    </div>
  );
}
