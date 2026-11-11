import { useTranslations } from "next-intl";
import type { HistoricalEvent } from "@/lib/api/memory";
import { DocumentThumbs } from "./documents";
import { Sources } from "./provenance";

/**
 * Содержимое события хронологии или места на карте: описание редакции, реквизиты, источник сведений
 * и связанные документы каталога с изображениями. `children` — ссылки-переходы под блоком.
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
    { label: t("source"), value: event.sources.length > 0 && <Sources items={event.sources} /> },
  ].filter((fact) => fact.value);
  return (
    <div className="space-y-4">
      {event.description && <p className="reading whitespace-pre-line" lang={event.title_lang}>{event.description}</p>}
      {event.documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("documents")}</p>
          <DocumentThumbs items={event.documents} />
        </div>
      )}
      {facts.length > 0 && (
        <dl className="space-y-1.5 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children && <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{children}</p>}
    </div>
  );
}
