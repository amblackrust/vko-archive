"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ListItem, type Values } from "@/lib/api/admin-content";
import { formatDateTime } from "@/lib/dates";
import { useMe } from "../admin-provider";
import { WorkflowBadge } from "../kit/badge";
import { DataTable, RowAction, RowTitle, type Column } from "../kit/data-table";
import { ConfirmDialog } from "../kit/dialog";
import { useDebounced, useLoad } from "../kit/hooks";
import { EmptyState } from "../kit/notice";
import { SearchField, Toolbar } from "../kit/page";
import { useToast } from "../kit/toast";
import { ObjectDialog } from "./object-dialog";
import { KINDS } from "./specs";

interface ResourceListProps {
  kind: string;
  /** Название списка для экранного диктора. */
  caption: string;
  /** Шапка колонки с номером, шифром или адресом; без неё колонка не выводится. */
  numberHeader?: string;
  /** Номер или шифр идёт перед названием (каталог); иначе адрес стоит после названия. */
  numberFirst?: boolean;
  /** Показать только вложенные в родителя (описи фонда, дела описи…). */
  parentId?: string;
  /** Поля нового объекта, заданные заранее (ссылка на родителя). */
  createDefaults?: Values;
  /** Создание недоступно независимо от прав (например, опись вне фонда) — с пояснением вместо кнопки. */
  createBlocked?: string;
  /** Нажатие на название открывает вложенный уровень, а не форму. */
  onOpen?: (row: ListItem) => void;
  /** Дополнительные колонки между названием и статусом. */
  columns?: Column<ListItem>[];
  /** Дополнительные кнопки строки (состав коллекции, экспонаты). */
  rowActions?: (row: ListItem, name: string) => React.ReactNode;
  /** Сменить, чтобы перечитать список снаружи. */
  refreshKey?: number;
  pageSize?: number;
  /** Что сказать, когда записей ещё нет. */
  emptyText: string;
}

/**
 * Список объектов одного вида: поиск, таблица со статусом согласования, создание и правка в рабочей панели,
 * удаление с подтверждением. Один компонент для каталога, филиалов, выставок, контента и «Архива памяти».
 */
export function ResourceList({ kind, caption, numberHeader, numberFirst, parentId, createDefaults, createBlocked, onOpen, columns = [], rowActions, refreshKey = 0, pageSize = 20, emptyText }: ResourceListProps) {
  const { module, ns } = KINDS[kind];
  const t = useTranslations("admin.list");
  const tn = useTranslations(ns);
  const locale = useLocale();
  const me = useMe();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ListItem | null>(null);

  useEffect(() => setPage(1), [kind, parentId, q]);
  const list = useLoad(() => contentApi.list(kind, { q: q || undefined, parent_id: parentId, page, page_size: pageSize }), [kind, q, parentId, page, refreshKey], "catalog");
  const nameOf = (row: ListItem) => pickName(row.title, locale) || row.number || "—";

  const number: Column<ListItem>[] = numberHeader
    ? [{ key: "number", header: numberHeader, className: numberFirst ? "md:w-40" : "md:w-56", cell: (row) => <span className={numberFirst ? "cipher font-medium" : "cipher text-muted-foreground"}>{row.number ?? "—"}</span> }]
    : [];
  const table: Column<ListItem>[] = [
    ...(numberFirst ? number : []),
    {
      key: "title",
      header: t("title"),
      primary: true,
      cell: (row) => <RowTitle onClick={() => (onOpen ? onOpen(row) : setEditing({ id: row.id }))}>{nameOf(row)}</RowTitle>,
    },
    ...(numberFirst ? [] : number),
    ...columns,
    { key: "status", header: t("status"), cell: (row) => <WorkflowBadge status={row.workflow_status} /> },
    { key: "updated", header: t("updated"), className: "md:whitespace-nowrap", cell: (row) => <time dateTime={row.updated_at} className="tabular-nums text-muted-foreground">{formatDateTime(row.updated_at)}</time> },
    {
      key: "actions",
      header: t("actions"),
      actions: true,
      className: "md:w-px md:whitespace-nowrap",
      cell: (row) => (
        <div className="flex gap-0.5 max-md:-ml-2 md:justify-end">
          {rowActions?.(row, nameOf(row))}
          <RowAction label={t("edit", { name: nameOf(row) })} onClick={() => setEditing({ id: row.id })}><Pencil /></RowAction>
          {can(me, `${module}.delete`) && <RowAction danger label={t("delete", { name: nameOf(row) })} onClick={() => setRemoving(row)}><Trash2 /></RowAction>}
        </div>
      ),
    },
  ];

  const canCreate = can(me, `${module}.create`);
  return (
    <div className="space-y-3">
      <Toolbar
        actions={
          canCreate && !createBlocked ? (
            <Button onClick={() => setEditing({ id: null })}>
              <Plus aria-hidden />
              {tn(`create.${kind}`)}
            </Button>
          ) : undefined
        }
      >
        <SearchField label={t("search")} value={search} onChange={setSearch} />
      </Toolbar>
      {canCreate && createBlocked && <p className="text-sm text-muted-foreground">{createBlocked}</p>}
      <DataTable
        caption={caption}
        columns={table}
        rows={list.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty={<EmptyState title={q ? t("nothingFound") : t("empty")}>{q ? t("nothingFoundHint") : emptyText}</EmptyState>}
        pagination={list.data ? { page, pageSize, total: list.data.total, onPage: setPage } : undefined}
      />
      {editing && (
        <ObjectDialog key={`${kind}-${editing.id ?? "new"}`} kind={kind} id={editing.id} createDefaults={createDefaults} onClose={() => setEditing(null)} onSaved={list.reload} />
      )}
      {removing && (
        <ConfirmDialog
          danger
          scope="catalog"
          title={t("deleteTitle")}
          description={t("deleteText", { name: nameOf(removing) })}
          confirmLabel={t("deleteConfirm")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await contentApi.remove(kind, removing.id);
            toast.success(t("deleted"));
            list.reload();
          }}
        />
      )}
    </div>
  );
}
