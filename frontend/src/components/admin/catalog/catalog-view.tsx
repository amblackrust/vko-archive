"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/ui/state-view";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { Pagination } from "../pagination";
import { useLoad } from "../use-load";
import { useCatalogError } from "./use-catalog-error";
import { CATALOG_KINDS, CATALOG_SPECS, type CatalogKind } from "./specs";
import { ObjectDialog } from "./object-dialog";

const PAGE_SIZE = 20;
const PARENT_FIELD: Partial<Record<CatalogKind, string>> = { inventory: "fund_id", case: "inventory_id", document: "case_id" };
const CHILD_KIND: Partial<Record<CatalogKind, CatalogKind>> = { fund: "inventory", inventory: "case", case: "document" };

interface Parent {
  kind: CatalogKind;
  id: string;
  label: string;
}

function CatalogContent() {
  const t = useTranslations("adminCatalog");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const describe = useCatalogError();
  const [kind, setKind] = useState<CatalogKind>("fund");
  // Цепочка выбранных родителей: фонд → опись → дело; список показывает детей последнего.
  const [trail, setTrail] = useState<Parent[]>([]);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const branches = useLoad(() => contentApi.branchOptions(), []);
  const parent = trail.at(-1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoad(
    () => contentApi.list(kind, { q: q || undefined, parent_id: parent?.id, page, page_size: PAGE_SIZE }),
    [kind, q, parent?.id, page],
  );
  const title = (item: ListItem) => pickName(item.title, locale);

  function switchKind(next: CatalogKind) {
    setKind(next);
    setTrail([]);
    setPage(1);
  }

  function open(item: ListItem) {
    const child = CHILD_KIND[kind];
    if (!child) return setDialog({ id: item.id });
    setTrail([...trail, { kind, id: item.id, label: `${item.number ?? ""} ${title(item)}`.trim() }]);
    setKind(child);
    setPage(1);
  }

  function crumb(index: number) {
    const target = trail[index];
    setTrail(trail.slice(0, index));
    setKind(target.kind);
    setPage(1);
  }

  const columns: Column<ListItem>[] = [
    {
      key: "number",
      header: t(`columns.number.${kind}`),
      cell: (row) =>
        CHILD_KIND[kind] ? (
          <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => open(row)}>
            {row.number}
          </button>
        ) : (
          <span className="font-medium">{row.number}</span>
        ),
    },
    { key: "title", header: t("columns.title"), cell: (row) => title(row) || "—" },
    { key: "status", header: t("columns.status"), cell: (row) => t(`status.${row.workflow_status}`) },
  ];
  if (CHILD_KIND[kind]) columns.push({ key: "children", header: t("columns.children"), cell: (row) => row.children ?? 0 });
  columns.push({
    key: "actions",
    header: tc("actions"),
    className: "whitespace-nowrap",
    cell: (row) => (
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" aria-label={t("editItem", { name: row.number ?? "" })} onClick={() => setDialog({ id: row.id })}>
          <Pencil />
        </Button>
        {can(me, "catalog.delete") && (
          <Button size="icon" variant="ghost" aria-label={t("deleteItem", { name: row.number ?? "" })} onClick={() => setRemoving(row)}>
            <Trash2 />
          </Button>
        )}
      </div>
    ),
  });

  const parentField = PARENT_FIELD[kind];
  // Дочерние объекты создаются внутри выбранного родителя.
  const canCreate = can(me, "catalog.create") && (kind === "fund" || parent !== undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
        {canCreate && (
          <Button onClick={() => setDialog({ id: null })}>
            <Plus aria-hidden />
            {t(`create.${kind}`)}
          </Button>
        )}
      </div>
      {notice && <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">{notice}</p>}
      <div role="tablist" aria-label={t("levels")} className="flex flex-wrap gap-1">
        {CATALOG_KINDS.map((item) => (
          <Button key={item} role="tab" aria-selected={kind === item} size="sm" variant={kind === item ? "primary" : "outline"} onClick={() => switchKind(item)}>
            {t(`kinds.${item}`)}
          </Button>
        ))}
      </div>
      {trail.length > 0 && (
        <nav aria-label={t("breadcrumbs")} className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => switchKind("fund")}>
            {t("kinds.fund")}
          </button>
          {trail.map((item, index) => (
            <span key={item.id} className="flex items-center gap-1">
              <ChevronRight className="size-3" aria-hidden />
              <button type="button" className="underline-offset-2 hover:underline" onClick={() => crumb(index)}>
                {item.label}
              </button>
            </span>
          ))}
        </nav>
      )}
      <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      <DataTable
        caption={t(`kinds.${kind}`)}
        columns={columns}
        rows={list.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyText={t("empty")}
      />
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />}

      {dialog && (
        <ObjectDialog
          key={`${kind}-${dialog.id ?? "new"}`}
          kind={kind}
          id={dialog.id}
          spec={CATALOG_SPECS[kind]}
          branches={branches.data ?? []}
          createDefaults={parentField && parent ? { [parentField]: parent.id } : undefined}
          fileOwner={kind === "document" ? "document" : undefined}
          onClose={() => setDialog(null)}
          onSaved={list.reload}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("deleteTitle")}
          description={t("deleteDescription", { name: removing.number ?? "" })}
          confirmLabel={t("delete")}
          onConfirm={async () => {
            try {
              await contentApi.remove(kind, removing.id);
              setNotice(t("deleted"));
              list.reload();
            } catch (caught) {
              setNotice(describe(caught));
            }
          }}
        />
      )}
    </div>
  );
}

export function CatalogView() {
  const me = useMe();
  return can(me, "catalog.view") ? <CatalogContent /> : <ForbiddenState />;
}
