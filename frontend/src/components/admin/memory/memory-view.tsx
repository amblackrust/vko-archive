"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, Link2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { adminRequest, can, pickName } from "@/lib/api/admin";
import { contentApi, type ContentObject } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { RowAction } from "../kit/data-table";
import { AdminDialog, ConfirmDialog } from "../kit/dialog";
import { FieldGroup } from "../kit/form";
import { useAction } from "../kit/hooks";
import { EmptyState, NoAccess, Notice } from "../kit/notice";
import { AdminPage, TabPanel, Tabs, useTabParam } from "../kit/page";
import { useApiError } from "../kit/use-api-error";
import { I18nField } from "../objects/i18n-field";
import { ObjectSearch, PickedRow } from "../objects/object-search";
import { ResourceList } from "../objects/resource-list";

const KINDS = ["collection", "person", "historical_event"] as const;
type MemoryKind = (typeof KINDS)[number];

/** «Архив памяти»: коллекции и их состав, личности и события хронологии с источниками и документами. */
export function MemoryView() {
  const t = useTranslations("adminContent");
  const me = useMe();
  const panelId = useId();
  const [kind, setKind] = useTabParam(KINDS);
  const [links, setLinks] = useState<{ kind: MemoryKind; id: string; name: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  if (!can(me, "content.view")) return <NoAccess />;
  return (
    <AdminPage title={t("memory.title")} lead={t("memory.lead")}>
      <Tabs label={t("memory.title")} panelId={panelId} active={kind} onChange={setKind} tabs={KINDS.map((id) => ({ id, label: t(`tabs.${id}`) }))} />
      <TabPanel id={panelId} active={kind}>
        <ResourceList
          key={kind}
          kind={kind}
          caption={t(`tabs.${kind}`)}
          numberHeader={t(`columns.number.${kind}`)}
          emptyText={t(`emptyHint.${kind}`)}
          refreshKey={refresh}
          rowActions={(row, name) => can(me, "content.edit") && <RowAction label={t(`links.manage.${kind}`, { name })} onClick={() => setLinks({ kind, id: row.id, name })}><Link2 /></RowAction>}
        />
      </TabPanel>
      {links && (
        <LinksDialog
          {...links}
          onClose={() => {
            setLinks(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </AdminPage>
  );
}

type ItemType = "document" | "person" | "historical_event";
interface LinkRow {
  type: ItemType;
  id: string;
  label: string;
  note: Record<string, string>;
}

const TITLE_FIELD: Record<ItemType, string> = { document: "title", person: "name", historical_event: "title" };
const COLLECTION_TYPES = ["document", "person", "historical_event"] as const;
const DOCUMENT_ONLY = ["document"] as const;

function labelOf(type: ItemType, object: ContentObject, locale: string): string {
  const title = object.values[TITLE_FIELD[type]] as Record<string, string> | undefined;
  return (title && pickName(title, locale)) || object.id.slice(0, 8);
}

/**
 * Связи: состав коллекции (документы, личности, события, порядок, примечания) или документы личности и события.
 * Сохраняется одним запросом с версией объекта (409 при чужой правке).
 */
function LinksDialog({ kind, id, name, onClose }: { kind: MemoryKind; id: string; name: string; onClose: () => void }) {
  const t = useTranslations("adminContent.links");
  const types = useTranslations("admin.objectTypes");
  const tc = useTranslations("admin.common");
  const te = useTranslations("admin.editor");
  const locale = useLocale();
  const describe = useApiError("catalog");
  const action = useAction("catalog");
  const [closing, setClosing] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loading = version === null && !loadError;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const object = await contentApi.get(kind, id);
        const raw =
          kind === "collection"
            ? (object.values.items as unknown as { item_type: ItemType; item_id: string; note: Record<string, string> }[])
            : (object.values.document_ids as unknown as string[]).map((documentId) => ({ item_type: "document" as ItemType, item_id: documentId, note: {} }));
        // Названия подгружаются по одному; если объект недоступен (нет прав), остаётся короткий id.
        const labels = await Promise.all(
          raw.map((item) => contentApi.get(item.item_type, item.item_id).then((loaded) => labelOf(item.item_type, loaded, locale), () => item.item_id.slice(0, 8))),
        );
        if (cancelled) return;
        setVersion(object.version);
        setLinks(raw.map((item, index) => ({ type: item.item_type, id: item.item_id, label: labels[index], note: item.note })));
      } catch (caught) {
        if (!cancelled) setLoadError(describe(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
    // describe пересоздаётся каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  function update(next: LinkRow[]) {
    setLinks(next);
    setDirty(true);
  }

  function move(index: number, delta: number) {
    const next = [...links];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(next);
  }

  async function save() {
    const body =
      kind === "collection"
        ? { version, items: links.map((link) => ({ item_type: link.type, item_id: link.id, note: link.note })) }
        : { version, document_ids: links.map((link) => link.id) };
    const path = kind === "collection" ? `/memory/collection/${id}/items` : `/memory/${kind}/${id}/documents`;
    const object = await adminRequest<ContentObject>(path, { method: "PUT", body });
    setVersion(object.version);
    setDirty(false);
  }
  const requestClose = () => (dirty ? setClosing(true) : onClose());

  return (
    <AdminDialog
      size="md"
      title={t(`title.${kind}`)}
      description={`${name}. ${t(`hint.${kind}`)}`}
      busy={action.pending}
      onClose={requestClose}
      footer={
        <>
          <p className="mr-auto self-center text-sm text-muted-foreground" aria-live="polite">{dirty ? t("unsaved") : ""}</p>
          <Button type="button" variant="outline" onClick={requestClose} disabled={action.pending}>{tc("close")}</Button>
          <Button type="button" onClick={() => void action.run(save, t("saved"))} disabled={action.pending || version === null || !dirty}>
            {action.pending ? tc("saving") : tc("save")}
          </Button>
        </>
      }
    >
      {loadError && <Notice kind="error">{loadError}</Notice>}
      {action.error && <Notice kind="error">{action.error}</Notice>}
      {loading && <Notice kind="loading">{tc("loading")}</Notice>}
      {version !== null && (
        <>
          {links.length === 0 ? (
            <EmptyState title={t("empty")} className="rounded-md border">{t("emptyHint")}</EmptyState>
          ) : (
            <ol className="divide-y rounded-md border">
              {links.map((link, index) => (
                <li key={`${link.type}-${link.id}`} className="space-y-2 px-3 py-2">
                  <PickedRow type={kind === "collection" ? types(link.type) : undefined} name={link.label}>
                    <span className="flex">
                      <RowAction label={t("up", { name: link.label })} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></RowAction>
                      <RowAction label={t("down", { name: link.label })} disabled={index === links.length - 1} onClick={() => move(index, 1)}><ArrowDown /></RowAction>
                      <RowAction label={t("remove", { name: link.label })} onClick={() => update(links.filter((_, i) => i !== index))}><X /></RowAction>
                    </span>
                  </PickedRow>
                  {kind === "collection" && (
                    <details open={Object.values(link.note).some(Boolean)}>
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">{t("note", { name: link.label })}</summary>
                      <div className="pt-2">
                        <I18nField multiline label={t("noteLabel")} value={link.note} onChange={(note) => update(links.map((row, i) => (i === index ? { ...row, note } : row)))} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
          <FieldGroup legend={t("add")} className="border-t pt-4">
            <ObjectSearch
              kinds={kind === "collection" ? COLLECTION_TYPES : DOCUMENT_ONLY}
              label={t("search")}
              pickLabel={t("addItem")}
              isPicked={(row, type) => links.some((link) => link.type === type && link.id === row.id)}
              onPick={(row, type) => update([...links, { type, id: row.id, label: pickName(row.title, locale) || row.id.slice(0, 8), note: {} }])}
            />
          </FieldGroup>
        </>
      )}
      {closing && (
        <ConfirmDialog danger title={te("discardTitle")} description={te("discardText")} confirmLabel={te("discard")} onClose={() => setClosing(false)} onConfirm={async () => onClose()} />
      )}
    </AdminDialog>
  );
}
