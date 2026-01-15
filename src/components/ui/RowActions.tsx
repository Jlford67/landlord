"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback } from "react";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";

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
      <LinkButton
        href={editHref}
        variant="ghost"
        size="sm"
        className="px-2"
        aria-label={ariaLabelEdit}
      >
        <Pencil size={18} className="text-blue-600" />
      </LinkButton>

      {deleteAction ? (
        <form action={deleteAction} onSubmit={onDeleteSubmit} data-lpignore="true" data-lastpass-ignore="true">
          <Button
            className="px-2"
            type="submit"
            variant="ghost"
            size="sm"
            mountGate
            aria-label={ariaLabelDelete}
          >
            <Trash2 size={18} className="text-blue-600" />
          </Button>
        </form>
      ) : null}
    </div>
  );
}
