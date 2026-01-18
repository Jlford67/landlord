import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import { Tags, Trash2 } from "lucide-react";
import { AddCategoryForm, CategoryInlineEditor } from "./CategoryClient";
import { ArrowLeft } from "lucide-react";
import LinkButton from "@/components/ui/LinkButton";
import SafeButton from "@/components/ui/SafeButton";

type CatType = "income" | "expense" | "transfer";

function canDelete(counts: { children: number; transactions: number }) {
  return counts.children === 0 && counts.transactions === 0;
}

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  parentId: string | null;
  _count: { transactions: number; children: number };
};

export default async function CategoriesPage(props: {
  searchParams?: Promise<{ msg?: string }>;
}) {
  await requireUser();
  const sp = (await props.searchParams) ?? {};
  const msg = typeof sp.msg === "string" ? sp.msg : "";

  const categories = await prisma.category.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true, children: true } },
    },
  });

  const byType: Record<CatType, CategoryRow[]> = {
    income: [],
    expense: [],
    transfer: [],
  };

  for (const c of categories) byType[c.type as CatType].push(c);

  const enabledCount = categories.filter((c) => c.active).length;
  const categoryOptions = categories
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, type: c.type as CatType, active: c.active }));

  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    const key = c.parentId ?? "";
    const list = childrenByParent.get(key) ?? [];
    list.push(c.id);
    childrenByParent.set(key, list);
  }

  const descendantMap = new Map<string, Set<string>>();
  const collectDescendants = (id: string): Set<string> => {
    const cached = descendantMap.get(id);
    if (cached) return cached;
    const set = new Set<string>();
    const children = childrenByParent.get(id) ?? [];
    for (const child of children) {
      set.add(child);
      for (const descendant of collectDescendants(child)) {
        set.add(descendant);
      }
    }
    descendantMap.set(id, set);
    return set;
  };

  for (const c of categories) collectDescendants(c.id);

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_card" style={{ marginBottom: 14 }}>
          <div className="ll_topbar" style={{ marginBottom: 0 }}>
            <div className="ll_topbarLeft flex items-center gap-3">
              <PageTitleIcon className="bg-amber-100 text-amber-700">
                <Tags size={18} />
              </PageTitleIcon>
              <div>
                <h1>Categories</h1>
                <div className="ll_muted">
                  Used for your ledger. Enabled:{" "}
                  <span className="ll_code">{enabledCount}</span> • Total:{" "}
                  <span className="ll_code">{categories.length}</span>
                </div>
              </div>
            </div>

            <div className="ll_topbarRight flex flex-wrap items-center gap-2">
              <LinkButton
                href="/properties"
                variant="outline"
                size="md"
                leftIcon={<ArrowLeft size={18} />}
              >
                Back
              </LinkButton>
            </div>
          </div>
        </div>


        {msg === "created" && <div className="ll_notice">Category created.</div>}
        {msg === "exists" && <div className="ll_notice">That category already exists.</div>}
        {msg === "deleted" && <div className="ll_notice">Category deleted.</div>}
        {msg === "deactivated" && (
          <div className="ll_notice">Category was disabled.</div>
        )}
        {msg === "disable_children_first" && (
          <div className="ll_notice">
            Disable all child categories first.
          </div>
        )}

        {msg === "notfound" && <div className="ll_notice">Category not found.</div>}
        {msg === "updated" && <div className="ll_notice">Category updated.</div>}

        <div style={{ marginTop: 14 }} className="ll_panelInner">
          <div className="ll_rowBetween" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Add category</h2>
            <div className="ll_muted">
              Seed defaults anytime: <span className="ll_code">npx prisma db seed</span>
            </div>
          </div>

          <AddCategoryForm categories={categoryOptions} />
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ marginBottom: 10 }}>All categories</h2>

          <Section
            title="Income"
            rows={byType.income}
            categories={categoryOptions}
            descendantMap={descendantMap}
          />
          <Section
            title="Expense"
            rows={byType.expense}
            categories={categoryOptions}
            descendantMap={descendantMap}
          />
          <Section
            title="Transfer"
            rows={byType.transfer}
            categories={categoryOptions}
            descendantMap={descendantMap}
          />
        </div>
      </div>

      <style>{`
        .ll_rowBetween { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .ll_panelInner { border-top: 1px solid var(--border); padding-top: 14px; }

        .ll_sectionTitle { margin-top: 14px; margin-bottom: 10px; font-size: 16px; opacity: 0.95; }

        .ll_catLeft { display:flex; align-items:center; gap:10px; min-width:0; }
        .ll_catTitle { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll_catMeta { font-size: 12px; opacity: 0.8; margin-top: 2px; }

        .ll_badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--border); background: #fafafa; color: var(--muted); font-weight: 800; }
        .ll_bullet { opacity: 0.55; font-size: 14px; width: 18px; text-align: center; }

        <div className={node.active ? "" : "ll_dim"}>
          ...all three columns...
        </div>

        .ll_actionsCell { display:flex; justify-content:flex-end; }
        .ll_actionStack { display:inline-flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
        .ll_inlineEditor { display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
        .ll_inlineEditorForm { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .ll_inlineEditorFields { display:flex; gap:8px; flex-wrap:wrap; }
        .ll_inlineEditorFields .ll_input { min-width: 160px; }
        .ll_inlineEditorActions { display:flex; gap:8px; align-items:center; }
        .ll_error { color: var(--danger, #dc2626); font-size: 12px; }

        .ll_actionStack .ll_btnLink,
        .ll_inlineEditorActions .ll_btnLink{
          color: var(--secondary);
        }

        .ll_btnDisabled {
          display: inline-flex;
          align-items: center;
          height: 30px;
          padding: 0 10px;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 700;
          color: #9ca3af;
          background: transparent;
          cursor: not-allowed;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  rows,
  categories,
  descendantMap,
}: {
  title: string;
  rows: CategoryRow[];
  categories: { id: string; name: string; type: CatType; active: boolean }[];
  descendantMap: Map<string, Set<string>>;
}) {
  if (rows.length === 0) return null;

  // Build a tree map: parentId -> children[]
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const r of rows) {
    const key = r.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(r);
    byParent.set(key, list);
  }

  // Sort children lists by name
  for (const [k, list] of byParent.entries()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
    byParent.set(k, list);
  }

  const roots = byParent.get(null) ?? [];
  const rendered: JSX.Element[] = [];

  const renderNode = (node: CategoryRow, depth: number) => {
    const children = byParent.get(node.id) ?? [];
    const deletable = canDelete(node._count);

    rendered.push(
      <div key={node.id} className={`ll_listRow ${node.active ? "" : "ll_dim"}`}>
        {/* Column 1: Category */}
        <div
          className="ll_catLeft"
          style={{ paddingLeft: depth === 0 ? 0 : 64 + (depth - 1) * 26 }}
        >
          {depth === 0 ? (
            <span className="ll_badge">{title}</span>
          ) : (
            <span className="ll_bullet">↳</span>
          )}

          <div style={{ minWidth: 0 }}>
            <div className="ll_catTitle">{node.name}</div>
            <div className="ll_catMeta">
              {node._count.children > 0 ? (
                <>
                  Children: <span className="ll_code">{node._count.children}</span> •{" "}
                </>
              ) : null}
              Txns: <span className="ll_code">{node._count.transactions}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Status */}
        <div className="ll_muted">
          {node.active ? "Enabled" : "Disabled"}
        </div>

        {/* Column 3: Actions */}
        <div className="ll_actionsCell">
          <div className="ll_actionStack">
            <CategoryInlineEditor
              category={{
                id: node.id,
                name: node.name,
                type: node.type as CatType,
                active: node.active,
                parentId: node.parentId,
                _count: node._count,
              }}
              categories={categories}
              descendantIds={Array.from(descendantMap.get(node.id) ?? new Set())}
            />
            {/* Enable/Disable always available */}
            <form method="post" action={`/api/categories/${node.id}/toggle`} style={{ margin: 0 }}>
              <input type="hidden" name="returnTo" value="/categories" />
              <SafeButton type="submit" className="ll_btnLink">
                {node.active ? "Disable" : "Enable"}
              </SafeButton>
            </form>


            {/* Delete only when safe */}
            {deletable ? (
              <form method="post" action={`/api/categories/${node.id}`} style={{ margin: 0 }}>
                <input type="hidden" name="returnTo" value="/categories" />
                <button
                  type="submit"
                  className="ll_btn ll_btnGhost"
                  aria-label={`Delete ${node.name}`}
                  suppressHydrationWarning
                  style={{ padding: "4px 6px" }}
                >
                  <Trash2 size={18} className="text-blue-600" />
                </button>
              </form>
            ) : (
              <span className="ll_btnDisabled" title="This category is in use or has children.">
                Can’t delete
              </span>
            )}
          </div>
        </div>
      </div>
    );

    for (const child of children) renderNode(child, depth + 1);
  };

  for (const r of roots) renderNode(r, 0);

  return (
    <div>
      <div className="ll_sectionTitle">{title}</div>

      <div className="ll_list">
        <div className="ll_listHeader">
          <div>Category</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        <div className="ll_listBody">{rendered}</div>
      </div>
    </div>
  );
}
