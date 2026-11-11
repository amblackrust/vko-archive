import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import type { SourceRef } from "@/lib/api/memory";

/** Откуда сведения: названия источников, со ссылкой, если она есть. Отсутствие источника тоже называется прямо. */
export function Sources({ items }: { items: SourceRef[] }) {
  const t = useTranslations("memory.provenance");
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("noSource")}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((source, i) => (
        <li key={i}>
          {source.url ? <ExternalLink href={source.url} className="text-link">{source.title}</ExternalLink> : source.title}
        </li>
      ))}
    </ul>
  );
}

/** Пометка записи, сведения которой даны только по источнику: подтверждающие архивные документы к ней не привязаны. */
export function UnconfirmedTag() {
  const t = useTranslations("memory.provenance");
  return (
    <span title={t("unconfirmedHint")} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-soft-foreground">
      <CircleHelp className="size-3.5 shrink-0" aria-hidden />
      {t("unconfirmed")}
    </span>
  );
}

/** Примечание редакции: отделено линейкой и подписью, чтобы его не приняли за сведения из архивного документа. */
export function EditorialNote({ children }: { children: React.ReactNode }) {
  const t = useTranslations("memory.provenance");
  return (
    <p className="mt-2 border-l-2 border-accent pl-3 text-sm">
      <span className="font-medium">{t("editorialNote")}:</span> {children}
    </p>
  );
}
