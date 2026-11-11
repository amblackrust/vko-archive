"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ContentObject, type ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { ObjectDialog } from "../catalog/object-dialog";
import { useCatalogError } from "../catalog/use-catalog-error";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable, type Column } from "../data-table";
import { Pagination } from "../pagination";
import { TranslationStatusBadge } from "../translations/translation-status-badge";
import { useLoad } from "../use-load";
import { CMS_FILES, CMS_SPECS } from "./specs";

const PAGE_SIZE = 20;

interface CmsListProps {
  kind: string;
  /** Дополнительные кнопки в строке (например, «Состав» у коллекции). */
  rowActions?: (row: ListItem) => React.ReactNode;
  /** Сигнал сменить список снаружи (после закрытия окна связей). */
  refreshKey?: number;
}

/** Список объектов одного вида CMS с поиском, созданием, редактированием (ObjectDialog) и удалением. */
export function CmsList({ kind, rowActions, refreshKey = 0 }: CmsListProps) {
  const t = useTranslations("adminContent");
  const tc = useTranslations("admin.common");
  const tw = useTranslations("adminCatalog");
  const locale = useLocale();
  const me = useMe();
  const describe = useCatalogError();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoad(() => contentApi.list(kind, { q: q || undefined, page, page_size: PAGE_SIZE }), [kind, q, page, refreshKey]);
  const files = CMS_FILES[kind];

  const columns: Column<ListItem>[] = [
    { key: "title", header: t("columns.title"), cell: (row) => <span className="font-medium">{pickName(row.title, locale) || "—"}</span> },
    { key: "number", header: t(`columns.number.${kind}`), cell: (row) => row.number ?? "—" },
    { key: "status", header: t("columns.status"), cell: (row) => tw(`status.${row.workflow_status}`) },
    {
      key: "actions",
      header: tc("actions"),
      className: "whitespace-nowrap",
      cell: (row) => {
        const name = pickName(row.title, locale);
        return (
          <div className="flex gap-1">
            {rowActions?.(row)}
            <Button size="icon" variant="ghost" aria-label={t("editItem", { name })} onClick={() => setDialog({ id: row.id })}>
              <Pencil />
            </Button>
            {can(me, "content.delete") && (
              <Button size="icon" variant="ghost" aria-label={t("deleteItem", { name })} onClick={() => setRemoving(row)}>
                <Trash2 />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        {can(me, "content.create") && (
          <Button onClick={() => setDialog({ id: null })}>
            <Plus aria-hidden />
            {t(`create.${kind}`)}
          </Button>
        )}
      </div>
      {notice && <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">{notice}</p>}
      <DataTable
        caption={t(`tabs.${kind}`)}
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
          spec={CMS_SPECS[kind]}
          ns="adminContent"
          fileOwner={files?.owner}
          pickField={files?.pickField}
          extra={(object) => <TranslationBadges object={object} />}
          onClose={() => setDialog(null)}
          onSaved={list.reload}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => !open && setRemoving(null)}
          title={tw("deleteTitle")}
          description={tw("deleteDescription", { name: pickName(removing.title, locale) })}
          confirmLabel={tw("delete")}
          onConfirm={async () => {
            try {
              await contentApi.remove(kind, removing.id);
              setNotice(tw("deleted"));
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

/** Статус перевода по языкам (проверенный / машинный / нет); машинный перевод — на странице «Переводы». */
function TranslationBadges({ object }: { object: ContentObject | null }) {
  const t = useTranslations("adminContent");
  if (!object) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t("translations")}>
      {(["kk", "ru", "en"] as const).map((lang) => (
        <TranslationStatusBadge key={lang} lang={lang} status={object.translation_status[lang] as "verified" | "machine" | "missing" | undefined} />
      ))}
    </div>
  );
}
