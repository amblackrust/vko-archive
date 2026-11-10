"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonalToggle } from "./personal-toggle";
import { usePersonalHistory } from "./personal-history";
import { RecommendationList } from "./recommendation-list";
import { useRecommendations } from "./use-recommendations";

/**
 * Карточка документа: переключатель персональных рекомендаций. Включён — просмотр
 * документа запоминается в этом браузере, и показывается «Вам может быть интересно»
 * по текущему и недавно просмотренным документам. «Связанные материалы» карточки
 * (по эмбеддингам) сервер отдаёт сам, этот блок их не дублирует без истории.
 */
export function PersonalRecommendations({ documentId }: { documentId: string }) {
  const t = useTranslations("aiDocument.recommendations");
  const locale = useLocale();
  const { enabled, history, setEnabled, record } = usePersonalHistory();
  const seen = history.filter((id) => id !== documentId).slice(0, 10);
  const state = useRecommendations(enabled && seen.length > 0 ? { type: "document", id: documentId, lang: locale, seen } : null);

  useEffect(() => {
    if (enabled) record(documentId);
  }, [enabled, documentId, record]);

  return (
    <section aria-labelledby="personal-recommendations-title" className="space-y-3 rounded-lg border bg-surface p-4">
      <h2 id="personal-recommendations-title" className="text-lg font-semibold">{t("personalTitle")}</h2>
      <PersonalToggle enabled={enabled} onChange={setEnabled} />
      {enabled && seen.length === 0 && <p className="text-sm text-muted-foreground">{t("personalEmpty")}</p>}
      {state.status === "loading" && <Skeleton className="h-24 w-full" />}
      {state.status === "error" && <p className="text-muted-foreground">{t("error")}</p>}
      {state.status === "done" &&
        (state.data.items.length > 0 ? <RecommendationList items={state.data.items} /> : <p className="text-muted-foreground">{t("empty")}</p>)}
    </section>
  );
}
