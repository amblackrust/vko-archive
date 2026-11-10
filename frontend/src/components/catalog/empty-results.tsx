import { Bot, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StateView } from "@/components/ui/state-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { similarDocuments } from "@/lib/api/document";

const NON_FILTERS = new Set(["sort", "page"]);

/**
 * Пустая выдача каталога (T3.8): что делать дальше. Условия поиска снимаются чипами выше
 * (ActiveFilters), здесь — подсказка, похожие материалы по тексту запроса и переход к ИИ.
 * Сам факт пустой выдачи пишется в SearchLog на сервере (zero_result).
 */
export async function EmptyResults({ params, locale }: { params: URLSearchParams; locale: string }) {
  const t = await getTranslations("document.empty");
  const text = params.get("q") ?? params.get("title") ?? params.get("keyword") ?? "";
  const hasFilters = [...params.keys()].some((key) => !NON_FILTERS.has(key));
  const similar = await similarDocuments(text, locale);
  return (
    <div className="space-y-4">
      <StateView icon={SearchX} title={t("title")} description={t("description")} as="h2" className="py-8">
        {hasFilters && (
          <Button asChild variant="outline">
            <Link href="/catalog">{t("resetAll")}</Link>
          </Button>
        )}
      </StateView>
      <ul className="mx-auto max-w-xl space-y-3 text-sm">
        {hasFilters && <li>{t("removeHint")}</li>}
        <li>{t("tips")}</li>
        {similar.length > 0 && (
          <li>
            <p className="font-medium">{t("similar")}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {similar.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="text-primary hover:underline">{item.title}</Link>
                </li>
              ))}
            </ul>
          </li>
        )}
        <li className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="sm">
            <Link href={text ? `/ai?q=${encodeURIComponent(text)}` : "/ai"}>
              <Bot aria-hidden />
              {t("askAi")}
            </Link>
          </Button>
          <span className="text-muted-foreground">{t("askAiHint")}</span>
        </li>
      </ul>
    </div>
  );
}
