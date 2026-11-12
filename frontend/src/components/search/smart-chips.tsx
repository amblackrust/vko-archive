"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Wand2 } from "lucide-react";
import { api, type Schema } from "@/lib/api/client";
import { useRouter } from "@/i18n/navigation";
import { periodLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = { q: string };

/** Shows how the query was understood (document type, place, years) and lets the visitor apply it as filters. */
export function SmartChips({ q }: Props) {
  const t = useTranslations("search");
  const d = useTranslations("dict");
  const locale = useLocale();
  const router = useRouter();
  const [res, setRes] = useState<Schema["AiParseResponse"] | null>(null);

  useEffect(() => {
    setRes(null);
    if (q.trim().length < 3) return;
    const ctl = new AbortController();
    api
      .post<Schema["AiParseResponse"]>("/api/ai/parse", { body: { q, lang: locale }, signal: ctl.signal, scope: "visitor" })
      .then(setRes)
      .catch(() => setRes(null));
    return () => ctl.abort();
  }, [q, locale]);

  const f = res?.filters ? { ...res.filters, doc_type: res.filters.doc_type ?? [], places: res.filters.places ?? [], period: res.filters.period ?? [] } : null;
  if (!res?.ai_available || !f) return null;
  const chips: string[] = [
    ...f.doc_type.map((x) => (d.has(`docType.${x}`) ? d(`docType.${x}`) : x)),
    ...f.places.map((x) => f.place_labels?.[x] ?? x),
    ...(f.period_range ? [`${f.period_range.from}–${f.period_range.to}`] : f.period.map((p) => periodLabel(p, d("periodSuffix")))),
    ...(res.parsed.persons ?? []),
  ];
  if (!chips.length) return null;

  const apply = () => {
    const sp = new URLSearchParams();
    sp.set("q", f.q || q);
    f.doc_type.forEach((x) => sp.append("doc_type", x));
    f.period.forEach((x) => sp.append("period", x));
    sp.set("f", "1");
    router.replace(`/search?${sp.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-ink-3"><Wand2 size={15} aria-hidden /> {t("recognized")}</span>
      {chips.map((c) => (
        <span key={c} className="inline-flex h-8 items-center rounded-full bg-action-soft px-3.5 text-sm text-action">{c}</span>
      ))}
      <Button size="sm" variant="secondary" onClick={apply}>{t("apply")} <ArrowRight size={14} aria-hidden /></Button>
    </div>
  );
}
