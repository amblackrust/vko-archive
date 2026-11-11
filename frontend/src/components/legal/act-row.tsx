import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import { RecordRow } from "@/components/ui/record-list";
import { fileUrl } from "@/lib/api/document";
import { formatIsoDate } from "@/lib/dates";
import { fileFormat, type LegalActItem, type LegalActStatus } from "./api";

/** Цвет точки статуса: смысл несёт подпись, цвет только помогает глазу. */
export const STATUS_DOTS: Record<LegalActStatus, string> = { active: "bg-success", amended: "bg-accent", expired: "bg-border-strong" };

/**
 * Строка акта или документа: номер, название, реквизиты, статус, официальная публикация и открытый файл.
 * `status={false}` — для внутренних документов (объявление, справка), у которых статус акта не имеет смысла.
 */
export function ActRow({ act, locale, status = true }: { act: LegalActItem; locale: string; status?: boolean }) {
  const t = useTranslations("legal");
  const date = formatIsoDate(act.date, locale);
  const checked = formatIsoDate(act.actualized_at, locale);
  const format = act.file && fileFormat(act.file.mime);
  return (
    <RecordRow
      code={act.number ? t("row.number", { number: act.number }) : undefined}
      title={act.title}
      lang={act.title_lang}
      meta={
        <>
          {date && <span>{t("row.date", { date })}</span>}
          {act.issuer && <span>{act.issuer}</span>}
          {checked && <span>{t("row.checked", { date: checked })}</span>}
        </>
      }
      aside={
        status && (
          <span className="inline-flex items-center gap-2 font-medium">
            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOTS[act.status]}`} aria-hidden />
            {t(`status.${act.status}`)}
          </span>
        )
      }
    >
      {(act.adilet_url || act.file) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.9375rem]">
          {act.adilet_url && <ExternalLink href={act.adilet_url} className="text-primary underline underline-offset-[3px]">{t("row.adilet")}</ExternalLink>}
          {act.file && (
            <a href={fileUrl(act.file.url)} className="inline-flex items-start gap-1.5 text-primary underline underline-offset-[3px] hover:decoration-2">
              <FileText className="mt-1 size-4 shrink-0" aria-hidden />
              {t("row.file")}
              <span className="text-muted-foreground">
                {[format, act.file.pages && t("row.pages", { count: act.file.pages })].filter(Boolean).join(", ")}
              </span>
            </a>
          )}
        </p>
      )}
    </RecordRow>
  );
}
