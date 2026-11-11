import { useTranslations } from "next-intl";
import { ExternalLink } from "@/components/ui/external-link";
import type { SourceRef } from "@/lib/api/memory";

/** Откуда сведения: названия источников, со ссылкой, если она есть. Без источников блок не выводится. */
export function Sources({ items }: { items: SourceRef[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((source, i) => (
        <li key={i} className="break-words">
          {source.url ? <ExternalLink href={source.url} className="text-link">{source.title}</ExternalLink> : source.title}
        </li>
      ))}
    </ul>
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
