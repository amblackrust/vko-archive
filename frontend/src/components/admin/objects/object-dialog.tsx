"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AdminApiError, can } from "@/lib/api/admin";
import { contentApi, type ContentObject, type UploadedFile, type Values } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { AdminDialog, ConfirmDialog } from "../kit/dialog";
import { Notice } from "../kit/notice";
import { useToast } from "../kit/toast";
import { useApiError } from "../kit/use-api-error";
import { TranslationBadges } from "../translations/translation-status-badge";
import { TRANSLATION_OBJECT_TYPES, type TranslationDetail } from "../translations/translations-api";
import { CoordsPicker } from "./coords-picker";
import { FieldsForm } from "./fields-form";
import { FilesPanel } from "./files-panel";
import { LinkPicker } from "./link-picker";
import { KINDS, SPECS } from "./specs";
import { WorkflowBar } from "./workflow-bar";

/** Значения, которые только закрывают доступ: их можно сохранить у опубликованного объекта без права публикации. */
const NARROWING: Record<string, string[]> = {
  file_access: ["restricted", "closed", "needs_review"],
  description_status: ["do_not_publish", "needs_review"],
};

/** Пустые строки списков (например, добавленное и не заполненное место) на сервер не уходят. */
function withoutEmptyRows(value: Values[string]): Values[string] {
  return Array.isArray(value) ? value.filter((item) => Object.values(item).some((text) => String(text).trim())) : value;
}

export interface ObjectDialogProps {
  /** Вид объекта из KINDS: fund, document, branch, news, collection… */
  kind: string;
  /** null — создание. */
  id: string | null;
  /** Поля, фиксируемые при создании (родитель: fund_id, inventory_id, exhibition_id…). */
  createDefaults?: Values;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Рабочая панель объекта: согласование, поля, файлы. Сохраняются только изменённые поля,
 * версия объекта защищает от чужой одновременной правки.
 */
export function ObjectDialog({ kind, id, createDefaults, onClose, onSaved }: ObjectDialogProps) {
  const { module, ns, files } = KINDS[kind];
  const spec = SPECS[kind];
  const t = useTranslations("admin");
  const tn = useTranslations(ns);
  const describe = useApiError("catalog");
  const toast = useToast();
  const me = useMe();
  const formId = useId();
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
  const [conflict, setConflict] = useState(false);
  const [closing, setClosing] = useState(false);
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
        setError(null);
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
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (object) {
        const changes = Object.fromEntries([...dirty].map((name) => [name, withoutEmptyRows(values[name])]));
        const next = Object.keys(changes).length ? await contentApi.update(kind, object.id, object.version, changes) : object;
        setObject(next);
        setValues(next.values);
      } else {
        const created = await contentApi.create(kind, Object.fromEntries(Object.entries(values).map(([name, value]) => [name, withoutEmptyRows(value)])));
        setCurrentId(created.id);
        setObject(created);
        setValues(created.values);
      }
      setDirty(new Set());
      setConflict(false);
      toast.success(t("editor.saved"));
      onSaved();
    } catch (caught) {
      setError(describe(caught));
      setConflict(caught instanceof AdminApiError && caught.code === "version_conflict");
    } finally {
      setPending(false);
    }
  }

  const editing = object !== null;
  const canEdit = can(me, `${module}.edit`);
  // Опубликованное или одобренное без права публикации: сервер примет только сужение доступа (DECISIONS п.76).
  const liveLocked = object !== null && ["published", "approved"].includes(object.workflow_status) && !can(me, "workflow.publish");
  const onlyNarrowing = dirty.size > 0 && [...dirty].every((name) => NARROWING[name]?.includes(String(values[name])));
  const machine =
    object !== null && dirty.size === 0 && ["draft", "needs_changes"].includes(object.workflow_status) && (TRANSLATION_OBJECT_TYPES as readonly string[]).includes(kind)
      ? {
          objectType: kind,
          objectId: object.id,
          version: object.version,
          // Сервер уже сохранил перевод: подтягиваем тексты, статусы и новую версию.
          onDone: (detail: TranslationDetail) => {
            const names = new Set(spec.map((field) => field.name));
            setObject({ ...object, version: detail.version, translation_status: detail.translation_status });
            setValues((current) => ({ ...current, ...Object.fromEntries(Object.entries(detail.fields).filter(([name]) => names.has(name))) }));
            onSaved();
          },
        }
      : undefined;
  const requestClose = () => (dirty.size > 0 ? setClosing(true) : onClose());

  return (
    <AdminDialog
      size="sheet"
      title={editing ? t(`objectTypes.${kind}`) : tn(`create.${kind}`)}
      description={object && object.path.length > 0 ? <span className="cipher">{object.path.map((item) => item.label).join(" / ")}</span> : undefined}
      srDescription={t("editor.description")}
      busy={pending}
      onClose={requestClose}
      footer={
        <>
          <p className="mr-auto self-center text-sm text-muted-foreground" aria-live="polite">
            {dirty.size > 0 ? t("editor.unsaved") : editing ? t("editor.allSaved") : ""}
          </p>
          <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>{t("common.close")}</Button>
          <Button type="submit" form={formId} disabled={pending || loading || (editing && !canEdit) || (liveLocked && !onlyNarrowing)}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      {loading && <Notice kind="loading">{t("common.loading")}</Notice>}
      {!loading && (
        <div className="space-y-5">
          {object && (
            <WorkflowBar
              object={object}
              dirty={dirty.size > 0}
              fieldLabel={(name) => (tn.has(`fields.${name}`) ? tn(`fields.${name}`) : name)}
              onChanged={(patch) => {
                setObject({ ...object, ...patch });
                onSaved();
              }}
            />
          )}
          {object && <TranslationBadges status={object.translation_status} />}
          {liveLocked && <Notice kind="info">{t("editor.liveLocked")}</Notice>}
          {!canEdit && editing && <Notice kind="info">{t("editor.readOnly")}</Notice>}
          {error && (
            <Notice
              kind="error"
              action={conflict && currentId ? <Button type="button" size="sm" variant="outline" onClick={() => setNonce((value) => value + 1)}>{t("editor.reload")}</Button> : undefined}
            >
              {error}
            </Notice>
          )}
          <form id={formId} onSubmit={submit} className="space-y-5">
            <FieldsForm spec={spec} values={values} onChange={change} translationStatus={object?.translation_status} editing={editing} ns={ns} machine={machine} ownerId={object?.id} />
            {kind === "branch" && (
              <CoordsPicker
                lat={(values.lat as number | null) ?? null}
                lng={(values.lng as number | null) ?? null}
                onChange={(lat, lng) => {
                  change("lat", lat);
                  change("lng", lng);
                }}
              />
            )}
            {kind === "exhibit" && (
              <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
                <LinkPicker kind="document" value={(values.document_id as string | null) ?? null} onChange={(next) => change("document_id", next)} />
                <LinkPicker kind="fund" value={(values.fund_id as string | null) ?? null} onChange={(next) => change("fund_id", next)} />
              </div>
            )}
          </form>
          {files && object && (
            <FilesPanel
              ownerType={files.owner}
              ownerId={object.id}
              canUpload={can(me, "files.upload") && canEdit}
              canDelete={can(me, "files.delete") && canEdit}
              pickedId={files.pickField ? (values[files.pickField] as string | null) : undefined}
              onPick={files.pickField ? (file: UploadedFile) => change(files.pickField!, file.id) : undefined}
            />
          )}
          {files && !editing && <Notice kind="info">{t("editor.filesAfterSave")}</Notice>}
        </div>
      )}
      {closing && (
        <ConfirmDialog
          danger
          title={t("editor.discardTitle")}
          description={t("editor.discardText")}
          confirmLabel={t("editor.discard")}
          onClose={() => setClosing(false)}
          onConfirm={async () => onClose()}
        />
      )}
    </AdminDialog>
  );
}
