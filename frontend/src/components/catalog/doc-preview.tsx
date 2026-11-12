"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ArrowUpRight, ImageOff } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { Link } from "@/i18n/navigation";
import { AccessBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Sleeve } from "@/components/ui/sleeve";
import { Media } from "@/components/ui/media";

export function useDocument(id: string | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: ["document", id, locale],
    enabled: !!id,
    queryFn: () => api.get<Schema["DocumentDetail"]>(`/api/catalog/documents/${id}`, { query: { lang: locale } }),
  });
}

/** Side preview of a document: the first sheet in a film sleeve, key facts, and the way in. */
export function DocPreview({ id }: { id: string | null }) {
  const t = useTranslations("document");
  const d = useTranslations("dict");
  const { data: doc, isLoading, isError } = useDocument(id);
  const [copied, setCopied] = useState(false);

  if (!id) return null;
  if (isLoading) return <div className="space-y-4" aria-busy><div className="aspect-[4/3] animate-pulse rounded-2xl bg-table-3" /><div className="h-6 w-2/3 animate-pulse rounded bg-table-3" /></div>;
  if (isError || !doc) return <p className="text-ink-3">…</p>;

  const file = doc.files?.[0];
  const open = doc.file_access === "open" && file?.preview_url;
  const rows: [string, string | null | undefined][] = [
    [t("fields.date"), doc.date_text],
    [t("fields.type"), doc.doc_type ? (d.has(`docType.${doc.doc_type}`) ? d(`docType.${doc.doc_type}`) : doc.doc_type) : null],
    [t("fields.places"), doc.places?.join(", ")],
    [t("fields.fund"), doc.fund ? `${doc.fund.number} · ${doc.fund.title}` : null],
    [t("fields.sheets"), doc.sheets_count?.toString()],
  ];

  return (
    <div>
      <Sleeve className="mb-4">
        <div className="grid h-[min(34dvh,20rem)] place-items-center overflow-hidden rounded-[16px] bg-sleeve-2">
          {open ? (
            <Media src={file.preview_url as string} alt={doc.title} className="max-h-full max-w-full object-contain" loading="eager" />
          ) : (
            <div className="grid size-full place-items-center text-[oklch(70%_0.01_240)]"><ImageOff size={34} strokeWidth={1.4} aria-hidden /></div>
          )}
        </div>
      </Sleeve>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AccessBadge access={doc.file_access} />
      </div>
      <h2 className="line-clamp-2 text-2xl md:text-3xl">{doc.title}</h2>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(doc.archive_code ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="edge mt-3 inline-flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-table-3"
        title={t("copyCode")}
      >
        {doc.archive_code} {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      </button>
      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        {rows.filter(([, v]) => v).slice(0, 4).map(([k, v]) => (
          <div key={k} className="flex gap-4 py-2"><dt className="w-28 shrink-0 text-ink-3">{k}</dt><dd className="line-clamp-1">{v}</dd></div>
        ))}
      </dl>
      {doc.summary && <p className="mt-3 line-clamp-2 text-ink-2">{doc.summary}</p>}
      <Link href={doc.href} className={buttonClass("primary", "mt-4")}>{t("viewer.openFile")} <ArrowUpRight size={16} aria-hidden /></Link>
    </div>
  );
}
