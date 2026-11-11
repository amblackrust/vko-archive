"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filesApi } from "@/lib/api/admin-content";
import { Select } from "../form-field";
import { useLoad } from "../use-load";

export interface MediaEntry {
  file_id?: string | null;
  url?: string | null;
}

interface Props {
  label: string;
  value: MediaEntry[];
  onChange: (value: MediaEntry[]) => void;
  /** Новость уже сохранена: можно выбирать файлы, загруженные к ней. */
  ownerId?: string;
}

/** Галерея новости: файлы, загруженные к ней, и внешние https-ссылки. Обложка выбирается отдельно. */
export function MediaField({ label, value, onChange, ownerId }: Props) {
  const t = useTranslations("adminContent.media");
  const [url, setUrl] = useState("");
  const [fileId, setFileId] = useState("");
  const files = useLoad(() => (ownerId ? filesApi.list("news", ownerId) : Promise.resolve([])), [ownerId]);
  const uploaded = files.data ?? [];
  const nameOf = (id: string) => uploaded.find((file) => file.id === id)?.original_name ?? id.slice(0, 8);

  function addUrl() {
    const href = url.trim();
    if (!/^https:\/\//i.test(href)) return;
    onChange([...value, { url: href }]);
    setUrl("");
  }

  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((entry, index) => {
            const name = entry.file_id ? nameOf(entry.file_id) : (entry.url ?? "");
            return (
              <li key={`${entry.file_id ?? entry.url}-${index}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{entry.file_id ? t("file") : t("link")}</span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { name })} onClick={() => onChange(value.filter((_, i) => i !== index))}>
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <Input type="url" aria-label={t("url")} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
        <Button type="button" variant="outline" onClick={addUrl} disabled={!/^https:\/\//i.test(url.trim())}><Plus aria-hidden />{t("addLink")}</Button>
      </div>
      {ownerId ? (
        <div className="flex gap-2">
          <Select aria-label={t("pickFile")} onFocus={files.reload} value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="">{t("pickFile")}</option>
            {uploaded.filter((file) => !value.some((entry) => entry.file_id === file.id)).map((file) => (
              <option key={file.id} value={file.id}>{file.original_name ?? file.id.slice(0, 8)}</option>
            ))}
          </Select>
          <Button type="button" variant="outline" disabled={!fileId} onClick={() => { onChange([...value, { file_id: fileId }]); setFileId(""); }}>
            <Plus aria-hidden />{t("addFile")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("filesAfterSave")}</p>
      )}
    </fieldset>
  );
}
