"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { AnswerText } from "@/components/ai/chat/answer-text";
import { AnswerExtras } from "@/components/ai/chat/source-cards";
import { useAnswer } from "@/components/ai/chat/use-answer";
import { FilterChip } from "@/components/catalog/filter-chip";
import { Button } from "@/components/ui/button";
import { withQuery } from "@/lib/api/catalog";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { addFilterHref, DOC_FILTERS, filterLabel, tabHref } from "./filters";

/** Режимы, в которых есть что читать: ответ модели либо справка сервера с источниками. Остальное — одна тихая строка. */
const WITH_ANSWER = new Set(["answer", "service", "restricted"]);

/**
 * Ответ помощника рядом с результатами поиска. Выдача от него не зависит: она уже на странице,
 * а блок только дописывает текст со ссылками на источники и предлагает условия, которые помощник
 * разобрал в запросе, — чипами-ссылками (применённые условия снимаются над результатами).
 * На телефоне блок свёрнут до двух строк и не сдвигает выдачу, пока идёт ответ.
 * `current` — условия из адреса страницы (query string).
 */
export function AiAnswer({ query, current }: { query: string; current: string }) {
  const t = useTranslations("search");
  const tc = useTranslations("catalog");
  const locale = useLocale();
  const { state, ask } = useAnswer(locale);
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    void ask(query);
  }, [ask, query]);

  const busy = state.status === "idle" || state.status === "loading";
  const result = state.status === "done" ? state.result : null;
  const answer = result && WITH_ANSWER.has(result.mode) ? result : null;
  const text = answer?.answer ?? (state.status === "loading" || state.status === "stopped" ? state.text : "");
  const filters = result?.filters ?? (state.status === "loading" ? state.meta?.filters : null);

  let quiet = "";
  if (result && !answer) quiet = t(result.mode === "off_topic" ? "ai.offTopic" : result.mode === "unavailable" ? "ai.unavailable" : "ai.notFound");
  else if (state.status === "rateLimited") quiet = state.retryAfter ? t("ai.rateLimited", { seconds: state.retryAfter }) : t("ai.rateLimitedNoTime");
  else if (state.status === "error") quiet = t("ai.unavailable");

  const params = new URLSearchParams(current);
  const proposals = filters
    ? [
        ...filters.types.filter((type) => type !== params.get("type")).map((type) => ({ label: filterLabel(t, tc, "type", type), href: tabHref(params, type) })),
        ...DOC_FILTERS.flatMap((key) =>
          filters[key].filter((value) => !params.getAll(key).includes(value)).map((value) => ({ label: filterLabel(t, tc, key, value), href: addFilterHref(params, key, value) })),
        ),
      ]
    : [];
  const catalog = new URLSearchParams(filters?.q ? { q: filters.q } : {});
  for (const key of DOC_FILTERS) for (const value of filters?.[key] ?? []) catalog.append(key, value);
  const more = Boolean(text) || proposals.length > 0;

  return (
    <section aria-labelledby={`${id}-title`} className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-lg">{t("ai.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("ai.label")}</p>
        </div>
        {more && (
          <Button variant="outline" size="sm" className="lg:hidden" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
            {t(open ? "ai.hide" : "ai.show")}
          </Button>
        )}
      </div>

      <div id={`${id}-body`} aria-live="polite" aria-busy={busy} className="mt-3 min-h-12 text-[0.9375rem]">
        {busy && !text && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t("ai.busy")}
          </p>
        )}
        {quiet && <p className="text-muted-foreground">{quiet}</p>}
        {text && (
          <div className={cn(!open && "max-lg:[&>p]:line-clamp-2")}>
            <AnswerText text={text} sources={answer?.sources ?? []} />
          </div>
        )}
        <div className={cn(!open && "max-lg:hidden")}>
          {answer && <AnswerExtras result={answer} />}
          {proposals.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">{t("ai.suggest")}</h3>
              <ul className="flex flex-wrap gap-2">
                {proposals.map((chip) => (
                  <li key={chip.href}><FilterChip add href={chip.href} label={chip.label} hint={t("filters.add", { name: chip.label })} /></li>
                ))}
              </ul>
              {DOC_FILTERS.some((key) => catalog.has(key)) && (
                <p className="text-sm"><Link href={withQuery("/catalog", catalog)} className="text-link">{t("ai.openInCatalog")}</Link></p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
