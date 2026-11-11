"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Images, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ContentObject } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { WorkflowBadge } from "../kit/badge";
import { RowAction } from "../kit/data-table";
import { AdminDialog, ConfirmDialog } from "../kit/dialog";
import { useAction, useLoad } from "../kit/hooks";
import { EmptyState, NoAccess, Notice } from "../kit/notice";
import { AdminPage } from "../kit/page";
import { ObjectDialog } from "../objects/object-dialog";
import { ResourceList } from "../objects/resource-list";

/** Онлайн-выставки: карточка выставки и её экспонаты (порядок, подписи, привязка к документам). */
export function ExhibitionsView() {
  const t = useTranslations("adminCatalog");
  const me = useMe();
  const [exhibits, setExhibits] = useState<{ id: string; name: string } | null>(null);
  if (!can(me, "content.view")) return <NoAccess />;
  return (
    <AdminPage title={t("exhibitions.title")} lead={t("exhibitions.lead")}>
      <ResourceList
        kind="exhibition"
        caption={t("exhibitions.title")}
        emptyText={t("exhibitions.empty")}
        columns={[{ key: "theme", header: t("fields.theme"), cell: (row) => (row.extra.theme as string | null) ?? "—" }]}
        rowActions={(row, name) => <RowAction label={t("exhibits.manage", { name })} onClick={() => setExhibits({ id: row.id, name })}><Images /></RowAction>}
      />
      {exhibits && <ExhibitsDialog exhibitionId={exhibits.id} name={exhibits.name} onClose={() => setExhibits(null)} />}
    </AdminPage>
  );
}

/** Экспонаты выставки: порядок меняется перетаскиванием или кнопками «выше / ниже», правка — в рабочей панели. */
function ExhibitsDialog({ exhibitionId, name, onClose }: { exhibitionId: string; name: string; onClose: () => void }) {
  const t = useTranslations("adminCatalog.exhibits");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const list = useLoad(() => contentApi.exhibits(exhibitionId), [exhibitionId], "catalog");
  const action = useAction("catalog");
  const [order, setOrder] = useState<ContentObject[] | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<ContentObject | null>(null);
  const items = order ?? list.data ?? [];
  const canEdit = can(me, "content.edit");
  const titleOf = (item: ContentObject) => pickName(item.values.title as Record<string, string>, locale) || "—";
  const refresh = () => {
    setOrder(null);
    list.reload();
  };

  async function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    const saved = await action.run(async () => setOrder(await contentApi.reorderExhibits(exhibitionId, next.map((item) => item.id))), t("reordered"));
    if (!saved) refresh();
  }

  return (
    <AdminDialog
      size="md"
      title={t("title")}
      description={`${name}. ${t("description")}`}
      onClose={onClose}
      footer={
        <>
          {can(me, "content.create") && (
            <Button type="button" variant="outline" className="mr-auto" onClick={() => setEditing({ id: null })}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          )}
          <Button type="button" onClick={onClose}>{tc("close")}</Button>
        </>
      }
    >
      {action.error && <Notice kind="error">{action.error}</Notice>}
      {list.error && <Notice kind="error">{list.error}</Notice>}
      {!list.data && !list.error && <Notice kind="loading">{tc("loading")}</Notice>}
      {list.data?.length === 0 && <EmptyState title={t("empty")} className="rounded-md border">{t("emptyHint")}</EmptyState>}
      {items.length > 0 && (
        <ol className="divide-y rounded-md border" aria-busy={action.pending}>
          {items.map((item, index) => (
            <li
              key={item.id}
              draggable={canEdit}
              onDragStart={() => setDragged(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragged !== null) void move(dragged, index);
                setDragged(null);
              }}
              className="flex flex-wrap items-center gap-2 p-2 text-sm"
            >
              {canEdit && <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
              <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="min-w-32 flex-1 break-words font-medium">{titleOf(item)}</span>
              <WorkflowBadge status={item.workflow_status} />
              <span className="flex">
                {canEdit && (
                  <>
                    <RowAction label={t("up", { name: titleOf(item) })} disabled={index === 0 || action.pending} onClick={() => void move(index, index - 1)}><ArrowUp /></RowAction>
                    <RowAction label={t("down", { name: titleOf(item) })} disabled={index === items.length - 1 || action.pending} onClick={() => void move(index, index + 1)}><ArrowDown /></RowAction>
                  </>
                )}
                <RowAction label={t("edit", { name: titleOf(item) })} onClick={() => setEditing({ id: item.id })}><Pencil /></RowAction>
                {can(me, "content.delete") && <RowAction danger label={t("delete", { name: titleOf(item) })} onClick={() => setRemoving(item)}><Trash2 /></RowAction>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <ObjectDialog key={editing.id ?? "new"} kind="exhibit" id={editing.id} createDefaults={{ exhibition_id: exhibitionId }} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
      {removing && (
        <ConfirmDialog
          danger
          scope="catalog"
          title={t("deleteTitle")}
          description={t("deleteText", { name: titleOf(removing) })}
          confirmLabel={t("deleteConfirm")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await contentApi.remove("exhibit", removing.id);
            refresh();
          }}
        />
      )}
    </AdminDialog>
  );
}
