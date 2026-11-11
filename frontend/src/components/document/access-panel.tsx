import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import { Notice } from "@/components/ui/notice";
import { Link } from "@/lib/i18n/navigation";
import type { DocumentItem } from "@/lib/api/catalog";

/**
 * Панель вместо просмотрщика, когда файлов для этого посетителя нет: что означает статус, условия доступа
 * из карточки и куда обращаться. Сайт заявок не принимает — только внешняя ссылка на eGov.kz.
 */
export function AccessPanel({ access, conditions, lang }: { access: DocumentItem["file_access"]; conditions: string; lang: string }) {
  const t = useTranslations("document.access");
  if (access === "open") {
    return (
      <Notice title={t("open.title")} className="p-6 text-base">
        <p>{t("open.text")}</p>
        <p className="mt-2"><Link href="/help/reading-room" className="text-link">{t("readingRoom")}</Link></p>
      </Notice>
    );
  }
  return (
    <Notice tone="locked" title={t(`${access}.title`)} className="p-6 text-base">
      <p>{t(`${access}.text`)}</p>
      {conditions && (
        <p className="mt-3">
          <span className="font-semibold">{t("conditions")}:</span> <span lang={lang} className="whitespace-pre-line">{conditions}</span>
        </p>
      )}
      <p className="mt-3">{t("howTo")}</p>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <ExternalLink href="https://egov.kz" className="font-semibold text-primary">{t("egov")}</ExternalLink>
        <Link href="/services/state" className="text-link">{t("service")}</Link>
      </p>
    </Notice>
  );
}
