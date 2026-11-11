"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AdminApiError, can } from "@/lib/api/admin";
import { contentApi, type ContentObject, type UploadedFile, type Values } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import type { FileOwner } from "./files-panel";
import { Notice } from "../notice";
import { FieldsForm, type BranchChoice, type FieldSpec } from "./fields-form";
import { FilesPanel } from "./files-panel";
import { useCatalogError } from "./use-catalog-error";
import { WorkflowBar } from "./workflow-bar";

/** Значения, которые только закрывают доступ: их можно сохранить у опубликованного объекта без права публикации. */
const NARROWING: Record<string, string[]> = {
  file_access: ["restricted", "closed", "needs_review"],
  description_status: ["do_not_publish", "needs_review"],
};

export interface ObjectDialogProps {
  kind: string;
  /** null — создание. */
  id: string | null;
  spec: FieldSpec[];
  /** Поля, фиксируемые при создании (родитель: fund_id, inventory_id, exhibition_id…). */
  createDefaults?: Values;
  branches?: BranchChoice[];
  /** Владелец файлов; без него панель файлов не показывается. */
  fileOwner?: FileOwner;
  /** Поле объекта, в которое выбирается файл (cover_file_id, photo_file_id, media_file_id). */
  pickField?: string;
  extra?: (object: ContentObject | null, onValues: (name: string, value: Values[string]) => void, values: Values) => React.ReactNode;
  /** Namespace подписей полей и заголовков (edit.<kind>, create.<kind>); по умолчанию каталог. */
  ns?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Окно создания/редактирования объекта: поля, согласование, файлы. Сохраняются только изменённые поля, версия — для блокировки. */
export function ObjectDialog({ kind, id, spec, createDefaults, branches, fileOwner, pickField, extra, ns = "adminCatalog", onClose, onSaved }: ObjectDialogProps) {
  const t = useTranslations("adminCatalog");
  const tn = useTranslations(ns);
  const tc = useTranslations("admin.common");
  const describe = useCatalogError();
  const me = useMe();
  const [currentId, setCurrentId] = useState(id);
  const [object, setObject] = useState<ContentObject | null>(null);
  // Обязательные списки сразу получают первый вариант: на экране он выбран, значит и уйдёт на сервер.
  const [values, setValues] = useState<Values>({
    ...Object.fromEntries(spec.flatMap((field) => (field.type === "select" && field.required ? [[field.name, field.options[0]]] : []))),
    ...createDefaults,
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(Boolean(id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    setLoading(true);
    contentApi
      .get(kind, currentId)
      .then((loaded) => {
        if (cancelled) return;
        setObject(loaded);
        setValues(loaded.values);
        setDirty(new Set());
        setConflict(false);
      })
      .catch((caught) => !cancelled && setError(describe(caught)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // describe пересоздаётся каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, currentId, nonce]);

  function change(name: string, value: Values[string]) {
    setValues((current) => ({ ...current, [name]: value }));
    setDirty((current) => new Set(current).add(name));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (object) {
        const changes = Object.fromEntries([...dirty].map((name) => [name, values[name]]));
        const next = Object.keys(changes).length ? await contentApi.update(kind, object.id, object.version, changes) : object;
        setObject(next);
        setValues(next.values);
        setDirty(new Set());
      } else {
        const created = await contentApi.create(kind, values);
        setCurrentId(created.id);
        setObject(created);
        setValues(created.values);
        setDirty(new Set());
      }
      setSaved(true);
      setConflict(false);
      onSaved();
    } catch (caught) {
      setError(describe(caught));
      setConflict(caught instanceof AdminApiError && caught.code === "version_conflict");
    } finally {
      setPending(false);
    }
  }

  const editing = object !== null;
  const canFiles = fileOwner !== undefined && editing;
  const moduleEdit = kind === "branch" ? "branches.edit" : ["fund", "inventory", "case", "document"].includes(kind) ? "catalog.edit" : "content.edit";
  // Опубликованное/одобренное без права публикации: сервер примет только сужение доступа (DECISIONS п.76).
  const liveLocked =
    object !== null && ["published", "approved"].includes(object.workflow_status) && !can(me, "workflow.publish");
  const onlyNarrowing = dirty.size > 0 && [...dirty].every((name) => NARROWING[name]?.includes(String(values[name])));

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !pending && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{tn(editing ? `edit.${kind}` : `create.${kind}`)}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("formDescription")}</Dialog.Description>
          {object && object.path.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{object.path.map((item) => item.label).join(" / ")}</p>
          )}
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">{tc("loading")}</p>
          ) : (
            <div className="mt-4 space-y-5">
              {object && (
                <WorkflowBar
                  object={object}
                  onChanged={(patch) => {
                    setObject({ ...object, ...patch });
                    onSaved();
                  }}
                />
              )}
              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <Notice
                    kind="error"
                    action={
                      conflict && currentId ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setNonce((value) => value + 1)}>
                          {t("reload")}
                        </Button>
                      ) : undefined
                    }
                  >
                    {error}
                  </Notice>
                )}
                {saved && <Notice kind="success">{t("saved")}</Notice>}
                {liveLocked && <Notice kind="info">{t("liveLocked")}</Notice>}
                <FieldsForm
                  idPrefix={`obj-${kind}`}
                  spec={spec}
                  values={values}
                  onChange={change}
                  branches={branches}
                  translationStatus={object?.translation_status}
                  editing={editing}
                  ns={ns}
                />
                {extra?.(object, change, values)}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                    {tc("cancel")}
                  </Button>
                  <Button type="submit" disabled={pending || (liveLocked && !onlyNarrowing)}>
                    {pending ? tc("saving") : tc("save")}
                  </Button>
                </div>
              </form>
              {canFiles && object && (
                <FilesPanel
                  ownerType={fileOwner}
                  ownerId={object.id}
                  canUpload={can(me, "files.upload") && can(me, moduleEdit)}
                  canDelete={can(me, "files.delete") && can(me, moduleEdit)}
                  pickedId={pickField ? (values[pickField] as string | null) : undefined}
                  onPick={pickField ? (file: UploadedFile) => change(pickField, file.id) : undefined}
                />
              )}
              {!editing && fileOwner && <p className="text-xs text-muted-foreground">{t("filesAfterSave")}</p>}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
