import { useTranslations } from "next-intl";
import type { HistoricalEvent } from "@/lib/api/memory";
import { DocumentRows } from "./documents";
import { Sources } from "./provenance";

/**
 * Содержимое события хронологии или места на карте: описание редакции, реквизиты, источник сведений
 * и связанные документы каталога. `children` — ссылки-переходы под блоком.
 */
export function EventBody({ event, date, children }: {
  event: HistoricalEvent;
  /** Дата строкой, если она не показана в заголовке записи. */
  date?: string | null;
  children?: React.ReactNode;
}) {
  const t = useTranslations("memory.event");
  const facts = [
    { label: t("date"), value: date },
    { label: t("place"), value: event.place },
    { label: t("source"), value: <Sources items={event.sources} /> },
  ];
  return (
    <div className="space-y-4">
      {event.description && <p className="reading max-w-3xl whitespace-pre-line" lang={event.title_lang}>{event.description}</p>}
      <dl className="space-y-2 text-sm">
        {facts.filter((fact) => fact.value).map((fact) => (
          <div key={fact.label} className="grid grid-cols-[5.5rem_1fr] gap-x-3">
            <dt className="font-medium">{fact.label}</dt>
            <dd className="min-w-0">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {event.documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("documents")}</p>
          <DocumentRows items={event.documents} nested />
        </div>
      )}
      {children && <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{children}</p>}
    </div>
  );
}
