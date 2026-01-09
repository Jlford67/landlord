"use client";

import { useMemo, useState } from "react";
import { Pencil, X } from "lucide-react";

type CatType = "income" | "expense" | "transfer";

type CategoryOption = {
  id: string;
  name: string;
  type: CatType;
  active: boolean;
};

type CategoryCounts = { transactions: number; children: number };

type CategoryRow = {
  id: string;
  name: string;
  type: CatType;
  active: boolean;
  parentId: string | null;
  _count: CategoryCounts;
};

const TYPE_LABELS: Record<CatType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

const TYPE_OPTIONS: CatType[] = ["income", "expense", "transfer"];

export function AddCategoryForm({ categories }: { categories: CategoryOption[] }) {
  const [type, setType] = useState<CatType>("income");

  const parentOptions = useMemo(
    () => categories.filter((cat) => cat.active && cat.type === type),
    [categories, type]
  );

  return (
    <form className="ll_form" method="post" action="/api/categories">
      <div className="ll_grid2">
        <div>
          <label className="ll_label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            className="ll_input"
            placeholder="e.g., Plumbing, Insurance"
            required
          />
        </div>

        <div>
          <label className="ll_label" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            className="ll_input"
            required
            value={type}
            onChange={(event) => setType(event.target.value as CatType)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ll_label" htmlFor="parentId">
            Parent (optional)
          </label>
          <select id="parentId" name="parentId" className="ll_input">
            <option value="">(no parent)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {TYPE_LABELS[c.type]} • {c.name}
              </option>
            ))}
          </select>
          <div className="ll_muted">Parent type must match (enforced on submit).</div>
        </div>
      </div>

      <div className="ll_actions">
        <button type="submit" className="ll_btn ll_btnPrimary">
          Add category
        </button>
      </div>
    </form>
  );
}

export function CategoryInlineEditor({
  category,
  categories,
  descendantIds,
}: {
  category: CategoryRow;
  categories: CategoryOption[];
  descendantIds: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [type, setType] = useState<CatType>(category.type);
  const [parentId, setParentId] = useState(category.parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canChangeType = category._count.transactions === 0 && category._count.children === 0;

  const parentOptions = useMemo(() => {
    const blocked = new Set(descendantIds);
    return categories.filter(
      (cat) =>
        (cat.active || cat.id === category.parentId) &&
        cat.type === type &&
        cat.id !== category.id &&
        !blocked.has(cat.id)
    );
  }, [categories, category.id, descendantIds, type]);

  const resetForm = () => {
    setName(category.name);
    setType(category.type);
    setParentId(category.parentId ?? "");
    setError(null);
  };

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
  };

  const handleTypeChange = (nextType: CatType) => {
    setType(nextType);
    if (
      parentId &&
      !categories.some(
        (cat) =>
          (cat.active || cat.id === parentId) &&
          cat.type === nextType &&
          cat.id === parentId &&
          cat.id !== category.id &&
          !descendantIds.includes(cat.id)
      )
    ) {
      setParentId("");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("type", type);
    formData.set("parentId", parentId);

    try {
      const response = await fetch(`/api/categories/${category.id}/update`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.error ?? "Unable to update category.");
        setIsSaving(false);
        return;
      }

      window.location.href = "/categories?msg=updated";
    } catch (err) {
      setError("Unable to update category.");
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        className="ll_btn ll_btnLink"
        onClick={() => setIsEditing(true)}
        aria-label={`Edit ${category.name}`}
        style={{ padding: "4px 6px" }}
      >
        <Pencil size={18} className="text-blue-600" />
      </button>
    );
  }

  return (
    <div className="ll_inlineEditor">
      <form className="ll_inlineEditorForm" onSubmit={handleSubmit}>
        <div className="ll_inlineEditorFields">
          <input
            className="ll_input"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <select
            className="ll_input"
            name="type"
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as CatType)}
            disabled={!canChangeType}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {TYPE_LABELS[opt]}
              </option>
            ))}
          </select>

          <select
            className="ll_input"
            name="parentId"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">(no parent)</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {TYPE_LABELS[option.type]} • {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ll_inlineEditorActions">
          <button type="submit" className="ll_btn ll_btnPrimary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button type="button" className="ll_btn ll_btnSecondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>

      <button
        type="button"
        className="ll_btn ll_btnLink"
        onClick={handleCancel}
        aria-label={`Close editor for ${category.name}`}
        style={{ padding: "4px 6px" }}
      >
        <X size={16} className="text-slate-500" />
      </button>

      {error ? <div className="ll_error">{error}</div> : null}
      {!canChangeType ? (
        <div className="ll_muted">Type changes are locked when a category has transactions or children.</div>
      ) : null}
    </div>
  );
}
