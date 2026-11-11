"use client";

import { useEffect, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RecordList, RecordRow } from "@/components/ui/record-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecommendationObjectType, RecommendationSourceType } from "./api";
import { usePersonalHistory } from "./personal-history";
import { useRecommendations } from "./use-recommendations";

/**
 * «Похожие материалы» для документа, выставки, подборки или новости: сервер подбирает публичные объекты
 * по эмбеддингам (без векторов — по тегам, фонду и словам). Переключатель включает учёт просмотренных
 * документов: история хранится только в этом браузере, а просмотр запоминается на карточке документа.
 */
export function SimilarMaterials({ type, id, types, limit = 6 }: {
  type: RecommendationSourceType;
  id: string;
  /** Типы рекомендуемых объектов; по умолчанию — тот же тип, что у источника. */
  types?: RecommendationObjectType[];
  limit?: number;
}) {
  const t = useTranslations("document.similar");
  const locale = useLocale();
  const titleId = useId();
  const { enabled, history, setEnabled, record } = usePersonalHistory();
  const state = useRecommendations({ type, id, lang: locale, types, limit, seen: history.filter((seen) => seen !== id) });

  useEffect(() => {
    if (enabled && type === "document") record(id);
  }, [enabled, type, id, record]);

  return (
    <section aria-labelledby={titleId} className="space-y-4">
      <h2 id={titleId} className="text-2xl">{t("title")}</h2>
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <Skeleton className="h-24 w-full" />}
        {state.status === "error" && <p className="text-muted-foreground">{t("error")}</p>}
        {state.status === "done" && state.data.items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        {state.status === "done" && state.data.items.length > 0 && (
          <RecordList>
            {state.data.items.map((item) => (
              <RecordRow
                key={`${item.type}-${item.id}`}
                title={item.title}
                href={item.href}
                lang={item.title_lang === locale ? undefined : item.title_lang}
                meta={
                  <>
                    <span>{t(`types.${item.type}`)}</span>
                    {item.document?.archive_code && <span className="cipher">{item.document.archive_code}</span>}
                    {item.document?.date_text && <span>{item.document.date_text}</span>}
                  </>
                }
              >
                {item.summary && <p className="mt-1 line-clamp-2 text-sm">{item.summary}</p>}
              </RecordRow>
            ))}
          </RecordList>
        )}
      </div>
      <label className="flex max-w-3xl cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span>
          <span className="font-medium">{t("personal")}</span>
          <span className="block text-muted-foreground">{t("personalHint")}</span>
        </span>
      </label>
    </section>
  );
}
