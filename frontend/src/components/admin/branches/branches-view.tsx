"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/ui/state-view";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { BRANCH_SPEC } from "../catalog/specs";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { ObjectDialog } from "../catalog/object-dialog";
import { useCatalogError } from "../catalog/use-catalog-error";
import { useLoad } from "../use-load";
import { CoordsPicker } from "./coords-picker";

function BranchesContent() {
  const t = useTranslations("adminCatalog");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const describe = useCatalogError();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoad(() => contentApi.list("branch", { q: q || undefined, page: 1, page_size: 100 }), [q]);

  const columns: Column<ListItem>[] = [
    { key: "name", header: t("columns.title"), cell: (row) => <span className="font-medium">{pickName(row.title, locale)}</span> },
    { key: "slug", header: t("fields.slug"), cell: (row) => row.number },
    { key: "map", header: t("fields.show_on_map"), cell: (row) => (row.extra.show_on_map ? t("yes") : t("no")) },
    { key: "status", header: t("columns.status"), cell: (row) => t(`status.${row.workflow_status}`) },
    {
      key: "actions",
      header: tc("actions"),
      className: "whitespace-nowrap",
      cell: (row) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={t("editItem", { name: pickName(row.title, locale) })} onClick={() => setDialog({ id: row.id })}>
            <Pencil />
          </Button>
          {can(me, "branches.delete") && (
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
        <h1 className="font-serif text-2xl font-semibold">{t("branchesTitle")}</h1>
        {can(me, "branches.create") && (
          <Button onClick={() => setDialog({ id: null })}>
            <Plus aria-hidden />
            {t("create.branch")}
          </Button>
        )}
      </div>
      {notice && <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">{notice}</p>}
      <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      <DataTable
        caption={t("branchesTitle")}
        columns={columns}
        rows={list.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyText={t("empty")}
      />
      {dialog && (
        <ObjectDialog
          key={dialog.id ?? "new"}
          kind="branch"
          id={dialog.id}
          spec={BRANCH_SPEC}
          fileOwner="branch"
          pickField="photo_file_id"
          extra={(_object, change, values) => (
            <CoordsPicker
              lat={(values.lat as number | null) ?? null}
              lng={(values.lng as number | null) ?? null}
              onChange={(lat, lng) => {
                change("lat", lat);
                change("lng", lng);
              }}
            />
          )}
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
          description={t("deleteDescription", { name: pickName(removing.title, locale) })}
          confirmLabel={t("delete")}
          onConfirm={async () => {
            try {
              await contentApi.remove("branch", removing.id);
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

export function BranchesView() {
  const me = useMe();
  return can(me, "branches.view") ? <BranchesContent /> : <ForbiddenState />;
}
