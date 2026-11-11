"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest, pickName } from "@/lib/api/admin";
import { contentApi, type ContentObject, type ListItem } from "@/lib/api/admin-content";
import { useCatalogError } from "../catalog/use-catalog-error";
import { FormField, Select } from "../form-field";
import { I18nField } from "../i18n-field";
import { Notice } from "../notice";

type ItemType = "document" | "person" | "historical_event";
interface Link {
  type: ItemType;
  id: string;
  label: string;
  note: Record<string, string>;
}

interface LinksDialogProps {
  /** collection — состав (документы, личности, события, порядок); person / historical_event — связанные документы. */
  kind: "collection" | "person" | "historical_event";
  id: string;
  onClose: () => void;
}

const TITLE_FIELD: Record<ItemType, string> = { document: "title", person: "name", historical_event: "title" };

function labelOf(type: ItemType, object: ContentObject, locale: string): string {
  const title = object.values[TITLE_FIELD[type]] as Record<string, string> | undefined;
  return (title && pickName(title, locale)) || object.id.slice(0, 8);
}

/** Окно связей: состав коллекции или документы личности/события. Сохраняется одним запросом с версией объекта (409 при чужой правке). */
export function LinksDialog({ kind, id, onClose }: LinksDialogProps) {
  const t = useTranslations("adminContent.links");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const describe = useCatalogError();
  const types: ItemType[] = kind === "collection" ? ["document", "person", "historical_event"] : ["document"];
  const [version, setVersion] = useState<number | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<ItemType>("document");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ListItem[] | null>(null);

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
        const loaded = await Promise.all(
          raw.map(async (item) => {
            try {
              return labelOf(item.item_type, await contentApi.get(item.item_type, item.item_id), locale);
            } catch {
              return item.item_id.slice(0, 8);
            }
          }),
        );
        if (cancelled) return;
        setVersion(object.version);
        setLinks(raw.map((item, index) => ({ type: item.item_type, id: item.item_id, label: loaded[index], note: item.note })));
      } catch (caught) {
        if (!cancelled) setError(describe(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // describe пересоздаётся каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  async function find() {
    setError(null);
    try {
      setResults((await contentApi.list(type, { q: q.trim() || undefined, page: 1, page_size: 8 })).items);
    } catch (caught) {
      setError(describe(caught));
    }
  }

  function add(row: ListItem) {
    if (links.some((link) => link.type === type && link.id === row.id)) return;
    setLinks([...links, { type, id: row.id, label: pickName(row.title, locale) || row.id.slice(0, 8), note: {} }]);
    setSaved(false);
  }

  function move(index: number, delta: number) {
    const next = [...links];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setLinks(next);
    setSaved(false);
  }

  async function save() {
    if (version === null) return;
    setPending(true);
    setError(null);
    try {
      const body =
        kind === "collection"
          ? { version, items: links.map((link) => ({ item_type: link.type, item_id: link.id, note: link.note })) }
          : { version, document_ids: links.map((link) => link.id) };
      const path = kind === "collection" ? `/memory/collection/${id}/items` : `/memory/${kind}/${id}/documents`;
      const object = await adminRequest<ContentObject>(path, { method: "PUT", body });
      setVersion(object.version);
      setSaved(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{t(`title.${kind}`)}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{t(`hint.${kind}`)}</Dialog.Description>
          {error && <Notice kind="error">{error}</Notice>}
          {saved && <Notice kind="success">{t("saved")}</Notice>}
          {loading ? (
            <p className="text-sm text-muted-foreground">{tc("loading")}</p>
          ) : (
            <>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <ol className="space-y-1.5">
                  {links.map((link, index) => (
                    <li key={`${link.type}-${link.id}`} className="rounded-md border px-3 py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{t(`types.${link.type}`)}</span>
                        <span className="min-w-0 flex-1 truncate">{link.label}</span>
                        <Button type="button" size="icon" variant="ghost" aria-label={t("up", { name: link.label })} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={t("down", { name: link.label })} disabled={index === links.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                        <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { name: link.label })} onClick={() => { setLinks(links.filter((_, i) => i !== index)); setSaved(false); }}><X /></Button>
                      </div>
                      {kind === "collection" && (
                        <details className="mt-1" open={Object.values(link.note).some(Boolean)}>
                          <summary className="cursor-pointer text-xs text-muted-foreground">{t("note", { name: link.label })}</summary>
                          <div className="mt-1.5">
                            <I18nField multiline label={t("noteLabel")} value={link.note} onChange={(note) => { setLinks(links.map((row, i) => (i === index ? { ...row, note } : row))); setSaved(false); }} />
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">{t("add")}</legend>
                <div className="flex flex-wrap gap-2">
                  {types.length > 1 && (
                    <FormField label={t("type")} htmlFor="links-type" className="w-48">
                      <Select id="links-type" value={type} onChange={(e) => { setType(e.target.value as ItemType); setResults(null); }}>
                        {types.map((option) => <option key={option} value={option}>{t(`types.${option}`)}</option>)}
                      </Select>
                    </FormField>
                  )}
                  <div className="flex min-w-48 flex-1 items-end gap-2">
                    <Input aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
                    <Button type="button" variant="outline" onClick={find}>{t("find")}</Button>
                  </div>
                </div>
                {results && (results.length === 0 ? <p className="text-xs text-muted-foreground">{t("nothing")}</p> : (
                  <ul className="space-y-1">
                    {results.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{pickName(row.title, locale)} {row.number ? <span className="text-muted-foreground">· {row.number}</span> : null}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => add(row)}><Plus aria-hidden />{t("addItem")}</Button>
                      </li>
                    ))}
                  </ul>
                ))}
              </fieldset>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
            <Button type="button" onClick={save} disabled={pending || loading || version === null}>{pending ? tc("saving") : tc("save")}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
