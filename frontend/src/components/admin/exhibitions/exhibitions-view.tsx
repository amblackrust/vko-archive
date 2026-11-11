"use client";

import { useEffect, useState } from "react";
import { Images, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/ui/state-view";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { ObjectDialog } from "../catalog/object-dialog";
import { EXHIBITION_SPEC } from "../catalog/specs";
import { useCatalogError } from "../catalog/use-catalog-error";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { Pagination } from "../pagination";
import { useLoad } from "../use-load";
import { ExhibitsDialog } from "./exhibits-dialog";

const PAGE_SIZE = 20;

function ExhibitionsContent() {
  const t = useTranslations("adminCatalog");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const describe = useCatalogError();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null);
  const [exhibits, setExhibits] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoad(() => contentApi.list("exhibition", { q: q || undefined, page, page_size: PAGE_SIZE }), [q, page]);

  const columns: Column<ListItem>[] = [
    { key: "title", header: t("columns.title"), cell: (row) => <span className="font-medium">{pickName(row.title, locale)}</span> },
    { key: "theme", header: t("fields.theme"), cell: (row) => (row.extra.theme as string | null) ?? "—" },
    { key: "status", header: t("columns.status"), cell: (row) => t(`status.${row.workflow_status}`) },
    {
      key: "actions",
      header: tc("actions"),
      className: "whitespace-nowrap",
      cell: (row) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={t("exhibits.manage", { name: pickName(row.title, locale) })} onClick={() => setExhibits(row.id)}>
            <Images />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t("editItem", { name: pickName(row.title, locale) })} onClick={() => setDialog({ id: row.id })}>
            <Pencil />
          </Button>
          {can(me, "content.delete") && (
            <Button size="icon" variant="ghost" aria-label={t("deleteItem", { name: pickName(row.title, locale) })} onClick={() => setRemoving(row)}>
              <Trash2 />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{t("exhibitionsTitle")}</h1>
        {can(me, "content.create") && (
          <Button onClick={() => setDialog({ id: null })}>
            <Plus aria-hidden />
            {t("create.exhibition")}
          </Button>
        )}
      </div>
      {notice && <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">{notice}</p>}
      <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      <DataTable
        caption={t("exhibitionsTitle")}
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
          key={dialog.id ?? "new"}
          kind="exhibition"
          id={dialog.id}
          spec={EXHIBITION_SPEC}
          fileOwner="exhibition"
          pickField="cover_file_id"
          onClose={() => setDialog(null)}
          onSaved={list.reload}
        />
      )}
      {exhibits && <ExhibitsDialog exhibitionId={exhibits} onClose={() => setExhibits(null)} />}
      {removing && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => !open && setRemoving(null)}
          title={t("deleteTitle")}
          description={t("deleteDescription", { name: pickName(removing.title, locale) })}
          confirmLabel={t("delete")}
          onConfirm={async () => {
            try {
              await contentApi.remove("exhibition", removing.id);
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

export function ExhibitionsView() {
  const me = useMe();
  return can(me, "content.view") ? <ExhibitionsContent /> : <ForbiddenState />;
}
