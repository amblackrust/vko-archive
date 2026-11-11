"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api/client";
import { FILE_ACCESS, filesApi, type UploadedFile } from "@/lib/api/admin-content";
import { Select } from "../form-field";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { useCatalogError } from "./use-catalog-error";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.mp3,.wav,.ogg,.oga,.flac,.m4a,.mp4,.m4v,.mov,.webm";

export type FileOwner = "document" | "exhibit" | "exhibition" | "branch" | "news" | "person" | "collection" | "legal_act";

interface FilesPanelProps {
  ownerType: FileOwner;
  ownerId: string;
  canUpload: boolean;
  canDelete: boolean;
  /** Файл загружен/удалён — родитель может обновить счётчики (например, выбор обложки). */
  onChanged?: (files: UploadedFile[]) => void;
  /** Выбор файла как обложки/фото/медиа (для филиала и выставки). */
  onPick?: (file: UploadedFile) => void;
  pickedId?: string | null;
}

/** Файлы объекта: пакетная загрузка (по одному запросу), уровень доступа (по умолчанию «на проверке»), удаление. */
export function FilesPanel({ ownerType, ownerId, canUpload, canDelete, onChanged, onPick, pickedId }: FilesPanelProps) {
  const t = useTranslations("adminCatalog.files");
  const describe = useCatalogError();
  const files = useLoad(() => filesApi.list(ownerType, ownerId), [ownerType, ownerId]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function refresh() {
    const list = await filesApi.list(ownerType, ownerId);
    files.reload();
    onChanged?.(list);
  }

  async function upload(selected: FileList | null) {
    if (!selected?.length) return;
    setBusy(true);
    setErrors([]);
    const failed: string[] = [];
    for (const file of Array.from(selected)) {
      try {
        await filesApi.upload(ownerType, ownerId, file);
      } catch (caught) {
        failed.push(`${file.name}: ${describe(caught)}`);
      }
    }
    setErrors(failed);
    setBusy(false);
    if (input.current) input.current.value = "";
    await refresh().catch(() => undefined);
  }

  async function act(action: () => Promise<unknown>) {
    setErrors([]);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setErrors([describe(caught)]);
    }
  }

  return (
    <section aria-label={t("title")} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        {canUpload && (
          <>
            <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" id={`upload-${ownerId}`} onChange={(e) => upload(e.target.files)} />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload aria-hidden />
              {busy ? t("uploading") : t("upload")}
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {errors.map((message) => (
        <Notice key={message} kind="error">
          {message}
        </Notice>
      ))}
      {files.error && <Notice kind="error">{files.error}</Notice>}
      <ul className="space-y-2">
        {files.data?.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm">
            {file.preview_url ? (
              // Превью отдаёт только бэкенд (/api/files), сотруднику — по его правам.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${API_URL}${file.preview_url}`} alt="" className="size-12 rounded object-cover" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded bg-surface-muted text-xs">{file.mime.split("/")[1]}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.original_name}</p>
              <p className="text-xs text-muted-foreground">
                {file.mime} · {Math.ceil(file.size / 1024)} KB{file.pages ? ` · ${t("pages", { count: file.pages })}` : ""}
              </p>
            </div>
            <Select
              className="w-auto"
              aria-label={t("access")}
              value={file.access}
              disabled={!canUpload}
              onChange={(e) => act(() => filesApi.update(file.id, { access: e.target.value }))}
            >
              {FILE_ACCESS.map((value) => (
                <option key={value} value={value}>
                  {t(`accessOptions.${value}`)}
                </option>
              ))}
            </Select>
            {onPick && (
              <Button type="button" size="sm" variant={pickedId === file.id ? "primary" : "outline"} onClick={() => onPick(file)}>
                {pickedId === file.id ? t("picked") : t("pick")}
              </Button>
            )}
            {canDelete && (
              <Button type="button" size="icon" variant="ghost" aria-label={t("delete", { name: file.original_name ?? "" })} onClick={() => act(() => filesApi.remove(file.id))}>
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {files.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </section>
  );
}
