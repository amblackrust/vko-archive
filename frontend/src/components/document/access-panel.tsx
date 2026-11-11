import { useTranslations } from "next-intl";
import { GovServiceCard } from "@/components/ui/brand";
import { LinkTile } from "@/components/ui/link-tile";
import type { DocumentItem } from "@/lib/api/catalog";

/**
 * Блок на месте просмотрщика, когда файлов для этого посетителя нет: что означает статус, условия доступа из карточки
 * и куда идти дальше — портал eGov.kz и страница услуги (или правила читального зала, если копии просто нет на сайте).
 */
export function AccessPanel({ access, conditions, lang }: { access: DocumentItem["file_access"]; conditions: string; lang: string }) {
  const t = useTranslations("document.access");
  const open = access === "open";
  return (
    <section aria-labelledby="doc-access" className="space-y-5">
      <div className="card p-6 sm:p-8">
        <h2 id="doc-access" className="text-xl sm:text-2xl">{t(`${access}.title`)}</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">{t(`${access}.text`)}</p>
        {!open && conditions && (
          <dl className="mt-5 border-t pt-5">
            <dt className="text-sm text-muted-foreground">{t("conditions")}</dt>
            <dd lang={lang} className="mt-1 whitespace-pre-line font-medium">{conditions}</dd>
          </dl>
        )}
      </div>
      {open ? (
        <LinkTile href="/help/reading-room" title={t("readingRoom")} />
      ) : (
        <ul className="grid auto-rows-fr gap-5 sm:grid-cols-2">
          <li><GovServiceCard id="egov" /></li>
          <li><LinkTile href="/services/state" title={t("service")} text={t("howTo")} /></li>
        </ul>
      )}
    </section>
  );
}
