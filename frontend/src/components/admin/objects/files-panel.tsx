"use client";

import { useRef, useState } from "react";
import { Check, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api/client";
import { FILE_ACCESS, filesApi, type UploadedFile } from "@/lib/api/admin-content";
import { RowAction } from "../kit/data-table";
import { ConfirmDialog } from "../kit/dialog";
import { Select } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { useApiError } from "../kit/use-api-error";
import { EmptyState, Notice } from "../kit/notice";
import type { FileOwner } from "./specs";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.mp3,.wav,.ogg,.oga,.flac,.m4a,.mp4,.m4v,.mov,.webm";

interface FilesPanelProps {
  ownerType: FileOwner;
  ownerId: string;
  canUpload: boolean;
  canDelete: boolean;
  /** Выбор файла как обложки, фото или медиа объекта. */
  onPick?: (file: UploadedFile) => void;
  pickedId?: string | null;
}

/** Файлы объекта: пакетная загрузка (по одному запросу на файл), уровень доступа (новый файл закрыт), удаление с подтверждением. */
export function FilesPanel({ ownerType, ownerId, canUpload, canDelete, onPick, pickedId }: FilesPanelProps) {
  const t = useTranslations("adminCatalog.files");
  const describe = useApiError("catalog");
  const files = useLoad(() => filesApi.list(ownerType, ownerId), [ownerType, ownerId], "catalog");
  const action = useAction("catalog");
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [removing, setRemoving] = useState<UploadedFile | null>(null);

  async function upload(selected: FileList | null) {
    if (!selected?.length) return;
    const queue = Array.from(selected);
    const errors: string[] = [];
    setFailed([]);
    for (const [index, file] of queue.entries()) {
      setProgress({ done: index, total: queue.length });
      try {
        await filesApi.upload(ownerType, ownerId, file);
      } catch (caught) {
        errors.push(`${file.name}: ${describe(caught)}`);
      }
    }
    setFailed(errors);
    setProgress(null);
    if (input.current) input.current.value = "";
    files.reload();
  }

  return (
    <section aria-label={t("title")} className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl space-y-1">
          <h3 className="text-base font-bold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void upload(event.target.files)} />
            <Button type="button" size="sm" variant="outline" disabled={progress !== null} onClick={() => input.current?.click()}>
              <Upload aria-hidden />
              {t("upload")}
            </Button>
          </>
        )}
      </div>
      <div aria-live="polite" className="space-y-2">
        {progress && <Notice kind="loading">{t("uploading", progress)}</Notice>}
        {failed.map((message) => <Notice key={message} kind="error">{message}</Notice>)}
        {action.error && <Notice kind="error">{action.error}</Notice>}
        {files.error && <Notice kind="error">{files.error}</Notice>}
      </div>
      {files.data?.length === 0 && <EmptyState title={t("empty")} className="rounded-md border px-4 py-5">{canUpload ? t("emptyHint") : undefined}</EmptyState>}
      {files.data && files.data.length > 0 && (
        <ul className="divide-y rounded-md border">
          {files.data.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              {file.preview_url ? (
                // Превью отдаёт только бэкенд (/api/files), сотруднику — по его правам.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${API_URL}${file.preview_url}`} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-surface-muted text-xs text-muted-foreground">{file.mime.split("/")[1]?.slice(0, 5)}</span>
              )}
              <div className="min-w-40 flex-1">
                <p className="break-all font-medium">{file.original_name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.mime} · {t("size", { kb: Math.ceil(file.size / 1024) })}{file.pages ? ` · ${t("pages", { count: file.pages })}` : ""}
                </p>
              </div>
              <Select
                className="w-auto"
                aria-label={t("access", { name: file.original_name ?? "" })}
                value={file.access}
                disabled={!canUpload || action.pending}
                onChange={(event) => void action.run(() => filesApi.update(file.id, { access: event.target.value }), t("accessSaved")).then(files.reload)}
              >
                {FILE_ACCESS.map((value) => <option key={value} value={value}>{t(`accessOptions.${value}`)}</option>)}
              </Select>
              {onPick && (
                <Button type="button" size="sm" variant="outline" aria-pressed={pickedId === file.id} onClick={() => onPick(file)}>
                  {pickedId === file.id && <Check aria-hidden />}
                  {pickedId === file.id ? t("picked") : t("pick")}
                </Button>
              )}
              {canDelete && <RowAction danger label={t("delete", { name: file.original_name ?? "" })} onClick={() => setRemoving(file)}><Trash2 /></RowAction>}
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmDialog
          danger
          scope="catalog"
          title={t("deleteTitle")}
          description={t("deleteText", { name: removing.original_name ?? "" })}
          confirmLabel={t("deleteConfirm")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await filesApi.remove(removing.id);
            files.reload();
          }}
        />
      )}
    </section>
  );
}
