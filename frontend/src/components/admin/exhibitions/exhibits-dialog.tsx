"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can, pickName } from "@/lib/api/admin";
import { contentApi, type ContentObject } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { EXHIBIT_SPEC } from "../catalog/specs";
import { ObjectDialog } from "../catalog/object-dialog";
import { useCatalogError } from "../catalog/use-catalog-error";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { LinkPicker } from "./link-picker";

interface ExhibitsDialogProps {
  exhibitionId: string;
  onClose: () => void;
}

/** Экспонаты выставки: порядок — перетаскиванием или кнопками «выше/ниже» (клавиатура), правка в отдельном окне. */
export function ExhibitsDialog({ exhibitionId, onClose }: ExhibitsDialogProps) {
  const t = useTranslations("adminCatalog.exhibits");
  const ts = useTranslations("adminCatalog.status");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const me = useMe();
  const describe = useCatalogError();
  const list = useLoad(() => contentApi.exhibits(exhibitionId), [exhibitionId]);
  const [order, setOrder] = useState<ContentObject[] | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const items = order ?? list.data ?? [];
  const canEdit = can(me, "content.edit");

  async function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    setError(null);
    try {
      const saved = await contentApi.reorderExhibits(exhibitionId, next.map((item) => item.id));
      setOrder(saved);
    } catch (caught) {
      setOrder(null);
      setError(describe(caught));
      list.reload();
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await contentApi.remove("exhibit", id);
      setOrder(null);
      list.reload();
    } catch (caught) {
      setError(describe(caught));
    }
    setRemoving(null);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{t("title")}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{t("description")}</Dialog.Description>
          <div className="mt-4 space-y-3">
            {error && <Notice kind="error">{error}</Notice>}
            {list.error && <Notice kind="error">{list.error}</Notice>}
            {can(me, "content.create") && (
              <Button type="button" size="sm" onClick={() => setEditing({ id: null })}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            )}
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  draggable={canEdit}
                  onDragStart={() => setDragged(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragged !== null) void move(dragged, index);
                    setDragged(null);
                  }}
                  className="flex items-center gap-2 rounded-md border bg-surface p-2 text-sm"
                >
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="w-6 text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{pickName(item.values.title as Record<string, string>, locale) || "—"}</span>
                  <span className="text-xs text-muted-foreground">{ts(item.workflow_status)}</span>
                  {canEdit && (
                    <>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("up")} disabled={index === 0} onClick={() => move(index, index - 1)}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("down")} disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>
                        <ArrowDown />
                      </Button>
                    </>
                  )}
                  <Button type="button" size="icon" variant="ghost" aria-label={t("edit")} onClick={() => setEditing({ id: item.id })}>
                    <Pencil />
                  </Button>
                  {can(me, "content.delete") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("delete")}
                      onClick={() => (removing === item.id ? void remove(item.id) : setRemoving(item.id))}
                    >
                      <Trash2 className={removing === item.id ? "text-destructive" : undefined} />
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            {removing && <p className="text-xs text-destructive">{t("confirmDelete")}</p>}
            {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                {tc("cancel")}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {editing && (
        <ObjectDialog
          key={editing.id ?? "new"}
          kind="exhibit"
          id={editing.id}
          spec={EXHIBIT_SPEC}
          createDefaults={{ exhibition_id: exhibitionId }}
          fileOwner="exhibit"
          pickField="media_file_id"
          extra={(_object, change, values) => (
            <div className="space-y-4">
              <LinkPicker kind="document" value={(values.document_id as string | null) ?? null} onChange={(id) => change("document_id", id)} />
              <LinkPicker kind="fund" value={(values.fund_id as string | null) ?? null} onChange={(id) => change("fund_id", id)} />
            </div>
          )}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setOrder(null);
            list.reload();
          }}
        />
      )}
    </Dialog.Root>
  );
}
