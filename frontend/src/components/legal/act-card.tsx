import { ExternalLink, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate, type LegalActItem } from "./api";

/** Карточка акта: реквизиты, статус, файл через /api/files и внешняя ссылка на «Әділет». */
export function LegalActCard({ act }: { act: LegalActItem }) {
  const t = useTranslations("legal");
  const requisites = [act.number && t("card.number", { number: act.number }), formatDate(act.date) && t("card.date", { date: formatDate(act.date) ?? "" })].filter(Boolean);
  const actualized = formatDate(act.actualized_at);
  return (
    <article className="space-y-3 rounded-lg border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug" lang={act.title_lang}>{act.title}</h3>
        <span className="rounded-sm border px-2 py-0.5 text-xs font-medium text-muted-foreground">{t(`status.${act.status}`)}</span>
      </div>
      {requisites.length > 0 && <p className="text-sm">{requisites.join(" · ")}</p>}
      {act.issuer && <p className="text-sm text-muted-foreground">{t("card.issuer")}: {act.issuer}</p>}
      {actualized && <p className="text-sm text-muted-foreground">{t("card.actualized", { date: actualized })}</p>}
      <div className="flex flex-wrap gap-4 text-sm">
        {act.file ? (
          <a href={act.file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileText className="size-4" aria-hidden />
            {t("card.file")}{act.file.pages ? ` (${t("card.pages", { count: act.file.pages })})` : ""}
          </a>
        ) : (
          <span className="text-muted-foreground">{t("card.noFile")}</span>
        )}
        {act.adilet_url && (
          <a href={act.adilet_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            {t("card.adilet")}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>
    </article>
  );
}
