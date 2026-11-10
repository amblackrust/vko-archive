"use client";

import { Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { cabinetFetch, type FavoriteItem, type Selection } from "./api";
import { useCabinetList } from "./use-cabinet-data";

/** Свои подборки: документы добавляются из избранного (так в подборку попадают только публичные документы). */
export function SelectionsPanel() {
  const t = useTranslations("cabinet.selections");
  const tErr = useTranslations("cabinet");
  const locale = useLocale();
  const { data, error, mutate } = useCabinetList<Selection[]>(`/selections?lang=${locale}`);
  const favorites = useCabinetList<FavoriteItem[]>(`/favorites?lang=${locale}`).data?.filter((f) => f.type === "document") ?? [];
  const [title, setTitle] = useState("");

  return (
    <section aria-labelledby="sel-title" className="space-y-3">
      <h2 id="sel-title" className="text-xl font-semibold">{t("title")}</h2>
      {error && <p role="alert" className="text-sm text-destructive">{tErr(error)}</p>}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate(() => cabinetFetch("/selections", { method: "POST", body: { title } }));
          setTitle("");
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("newTitle")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className="h-10 rounded-md border bg-background px-3 font-normal" />
        </label>
        <Button type="submit">{t("create")}</Button>
      </form>
      {data?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-3">
        {data?.map((selection) => (
          <li key={selection.id} className="space-y-2 rounded-md border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{selection.title}</h3>
              <button
                type="button"
                aria-label={t("delete", { title: selection.title })}
                onClick={() => mutate(() => cabinetFetch(`/selections/${selection.id}`, { method: "DELETE" }))}
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-muted"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            {selection.documents.length === 0 && <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>}
            <ul className="space-y-1 text-sm">
              {selection.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2">
                  <Link href={doc.href} className="break-words text-primary hover:underline">{doc.title}</Link>
                  <button
                    type="button"
                    aria-label={t("removeDocument", { title: doc.title })}
                    onClick={() => mutate(() => cabinetFetch(`/selections/${selection.id}/items/${doc.id}`, { method: "DELETE" }))}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-muted"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {favorites.length > 0 && (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const id = String(new FormData(event.currentTarget).get("document"));
                  void mutate(() => cabinetFetch(`/selections/${selection.id}/items`, { method: "POST", body: { document_id: id } }));
                }}
              >
                <select name="document" aria-label={t("addPick")} className="h-9 max-w-full rounded-md border bg-background px-2 text-sm">
                  {favorites.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">{t("add")}</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
