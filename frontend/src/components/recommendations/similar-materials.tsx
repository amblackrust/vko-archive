"use client";

import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecommendationObjectType, RecommendationSourceType } from "./api";
import { PersonalToggle } from "./personal-toggle";
import { usePersonalHistory } from "./personal-history";
import { RecommendationList } from "./recommendation-list";
import { useRecommendations } from "./use-recommendations";

/**
 * Блок «Похожие материалы» для выставки, коллекции, новости или документа (T4.12):
 * сервер подбирает публичные объекты по эмбеддингам (без векторов — по тегам/фонду/словам).
 * При включённых персональных рекомендациях учитывает просмотренные документы.
 */
export function SimilarMaterials({
  type,
  id,
  types,
  limit = 6,
}: {
  type: RecommendationSourceType;
  id: string;
  types?: RecommendationObjectType[];
  limit?: number;
}) {
  const t = useTranslations("aiDocument.recommendations");
  const locale = useLocale();
  const personal = usePersonalHistory();
  const state = useRecommendations({ type, id, lang: locale, types, limit, seen: personal.enabled ? personal.history : [] });

  return (
    <section aria-labelledby={`similar-${id}`} className="space-y-3">
      <h2 id={`similar-${id}`} className="text-xl font-semibold">{t("similarTitle")}</h2>
      <PersonalToggle enabled={personal.enabled} onChange={personal.setEnabled} />
      {state.status === "loading" && <Skeleton className="h-24 w-full" />}
      {state.status === "error" && <p className="text-muted-foreground">{t("error")}</p>}
      {state.status === "done" &&
        (state.data.items.length > 0 ? <RecommendationList items={state.data.items} /> : <p className="text-muted-foreground">{t("empty")}</p>)}
    </section>
  );
}
