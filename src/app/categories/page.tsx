import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type CatType = "income" | "expense" | "transfer";

function labelType(t: CatType) {
  if (t === "income") return "Income";
  if (t === "expense") return "Expense";
  return "Transfer";
}

function actionInfo(counts: { children: number; transactions: number }) {
  const hasChildren = counts.children > 0;
  const hasTxns = counts.transactions > 0;

  if (!hasChildren && !hasTxns) {
    return { canDelete: true, label: "Delete" as const };
  }

  if (hasTxns) {
    return { canDelete: false, label: "Deactivate (in use)" as const };
  }

  return { canDelete: false, label: "Deactivate (has children)" as const };
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
  const msg = sp.msg ?? "";

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

  const activeCount = categories.filter((c) => c.active).length;

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_rowBetween">
          <div>
            <h1>Categories</h1>
            <div className="ll_muted">
              Used for your ledger. Active: <span className="ll_code">{activeCount}</span> • Total:{" "}
              <span className="ll_code">{categories.length}</span>
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href="/properties">
              Back to properties
            </Link>
          </div>
        </div>

        {msg === "created" && <div className="ll_notice">Category created.</div>}
        {msg === "exists" && <div className="ll_notice">That category already exists.</div>}
        {msg === "deleted" && <div className="ll_notice">Category deleted.</div>}
        {msg === "deactivated" && (
          <div className="ll_notice">Category is in use, so it was deactivated instead of deleted.</div>
        )}
        {msg === "notfound" && <div className="ll_notice">Category not found.</div>}

        <div style={{ marginTop: 14 }} className="ll_panelInner">
          <div className="ll_rowBetween" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Add category</h2>
            <div className="ll_muted">
              Seed defaults anytime: <span className="ll_code">npx prisma db seed</span>
            </div>
          </div>

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
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label className="ll_label" htmlFor="type">
                  Type
                </label>
                <select id="type" name="type" className="ll_input" required suppressHydrationWarning>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="ll_label" htmlFor="parentId">
                  Parent (optional)
                </label>
                <select id="parentId" name="parentId" className="ll_input" suppressHydrationWarning>
                  <option value="">(no parent)</option>
                  {categories
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {labelType(c.type as CatType)} • {c.name}
                      </option>
                    ))}
                </select>
                <div className="ll_muted">Parent type must match (enforced on submit).</div>
              </div>
            </div>

            <div className="ll_actions">
              <button className="ll_btn" type="submit" suppressHydrationWarning>
                Add category
              </button>
            </div>
          </form>
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ marginBottom: 10 }}>All categories</h2>

          <Section title="Income" rows={byType.income} />
          <Section title="Expense" rows={byType.expense} />
          <Section title="Transfer" rows={byType.transfer} />
        </div>
      </div>

      <style>{`
        .ll_rowBetween { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .ll_panelInner { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; }

        .ll_sectionTitle { margin-top: 14px; margin-bottom: 10px; font-size: 16px; opacity: 0.95; }

        .ll_catRow { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .ll_catLeft { display:flex; align-items:center; gap:10px; min-width:0; }
        .ll_catTitle { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ll_catMeta { font-size: 12px; opacity: 0.8; margin-top: 2px; }

        .ll_badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); opacity: 0.95; }
        .ll_bullet { opacity: 0.55; font-size: 14px; width: 18px; text-align: center; }

        .ll_dim { opacity: 0.55; }

        .ll_actionsRight { display:flex; align-items:flex-end; }

        .ll_btnDanger {
          border: 1px solid rgba(255,255,255,0.18);
          background: transparent;
          color: rgba(255,255,255,0.92);
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 650;
        }
        .ll_btnDanger:hover { background: rgba(255,255,255,0.06); }

        .ll_btnDeactivate {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.92);
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 650;
        }
        .ll_btnDeactivate:hover { background: rgba(255,255,255,0.07); }
      `}</style>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: CategoryRow[] }) {
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
    const info = actionInfo(node._count);
    const children = byParent.get(node.id) ?? [];

    rendered.push(
      <div key={node.id} className={`ll_listRow ${node.active ? "" : "ll_dim"}`}>
        {/* Column 1: Category */}
        <div
          className="ll_catLeft"
          style={{ paddingLeft: depth === 0 ? 0 : 64 + (depth - 1) * 26 }}
        >
          {depth === 0 ? <span className="ll_badge">{title}</span> : <span className="ll_bullet">↳</span>}

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
        <div className="ll_muted">{node.active ? "Active" : "Inactive"}</div>

        {/* Column 3: Actions */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <form method="post" action={`/api/categories/${node.id}`} style={{ margin: 0 }}>
            <input type="hidden" name="returnTo" value="/categories" />
            <button
              className={info.canDelete ? "ll_btnDanger" : "ll_btnDeactivate"}
              type="submit"
              suppressHydrationWarning
            >
              {info.label}
            </button>
          </form>
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

