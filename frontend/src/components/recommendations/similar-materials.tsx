"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import type { RecommendationObjectType, RecommendationSourceType } from "./api";
import { usePersonalHistory } from "./personal-history";
import { useRecommendations } from "./use-recommendations";

/**
 * «Похожие материалы» для документа, выставки, подборки или новости: сервер подбирает публичные объекты
 * по эмбеддингам (без векторов — по тегам, фонду и словам). Показываются равными плитками — три в ряд, поэтому
 * лишние сверх кратного трём отбрасываются; если подобрать нечего или сервис недоступен, блока нет вовсе.
 * Учёт просмотренных документов включается тихой кнопкой у заголовка: история хранится только в этом браузере.
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

  const found = state.status === "done" ? state.data.items : [];
  const items = found.length > 3 ? found.slice(0, found.length - (found.length % 3)) : found;
  if (state.status === "error" || (state.status === "done" && items.length === 0)) return null;
  // Чётное число плиток на средней ширине встаёт в две колонки; три плитки ждут ширины под три колонки — пустых ячеек нет.
  const columns = items.length === 1 ? "" : items.length === 2 ? "@2xl:grid-cols-2" : items.length % 2 === 0 ? "@2xl:grid-cols-2 @4xl:grid-cols-3" : "@4xl:grid-cols-3";

  return (
    <section aria-labelledby={titleId} className="@container space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id={titleId} className="text-2xl sm:text-3xl">{t("title")}</h2>
        <button
          type="button"
          aria-pressed={enabled}
          title={t("personalHint")}
          onClick={() => setEnabled(!enabled)}
          className="text-left text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t(enabled ? "personalOn" : "personal")}
        </button>
      </div>
      <div aria-live="polite" aria-busy={state.status !== "done"}>
        {state.status !== "done" ? (
          <div className="grid gap-5 @4xl:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-40 rounded-lg" />)}
          </div>
        ) : (
          <ul className={cn("grid auto-rows-fr gap-5", columns)}>
            {items.map((item) => (
              <li key={`${item.type}-${item.id}`} className="card lift group relative flex h-full flex-col p-5">
                <h3 className="text-[1.0625rem] font-semibold leading-snug [text-wrap:pretty]" lang={item.title_lang === locale ? undefined : item.title_lang}>
                  <Link href={item.href} className="line-clamp-3 after:absolute after:inset-0 group-hover:text-primary">{item.title}</Link>
                </h3>
                {item.summary && <p className="mt-2 line-clamp-3 text-[0.9375rem] text-muted-foreground">{item.summary}</p>}
                <div className="mt-auto flex items-end gap-3 pt-4 text-sm">
                  <p className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`types.${item.type}`)}</span>
                    {item.document?.archive_code && <span className="cipher block truncate text-muted-foreground">{item.document.archive_code}</span>}
                  </p>
                  <ArrowRight className="mb-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
