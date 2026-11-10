import { ExternalLink, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Информационная карточка вместо просмотрщика: файла нет, только условия доступа и внешняя ссылка. */
export function AccessNotice({ access, conditions }: { access: "open" | "restricted" | "closed" | "needs_review"; conditions: string }) {
  const t = useTranslations("document.accessNotice");
  return (
    <section aria-labelledby="access-title" className="space-y-3 rounded-lg border bg-surface-muted p-5">
      <h2 id="access-title" className="flex items-center gap-2 text-lg font-semibold">
        <Lock className="size-5 text-primary" aria-hidden />
        {t("conditions")}
      </h2>
      <p>{t(access)}</p>
      <p className="whitespace-pre-line text-sm text-muted-foreground">{conditions || t("noConditions")}</p>
      <p className="text-sm">{t("howTo")}</p>
      <Button asChild variant="outline" size="sm">
        <a href="https://egov.kz" target="_blank" rel="noopener noreferrer">
          {t("egov")}
          <ExternalLink aria-hidden />
        </a>
      </Button>
    </section>
  );
}
