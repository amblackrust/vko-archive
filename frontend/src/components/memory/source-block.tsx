import { useTranslations } from "next-intl";
import type { SourceRef } from "@/lib/api/memory";

/** Редакционный текст и факты с источником показываются раздельно: здесь — подпись к тексту. */
export function EditorialNote() {
  const t = useTranslations("memory.editorial");
  return (
    <p className="rounded-md border border-dashed bg-surface-muted p-3 text-sm text-muted-foreground">
      <strong className="text-foreground">{t("label")}.</strong> {t("note")}
    </p>
  );
}

export function SourceList({ sources, headingId }: { sources: SourceRef[]; headingId: string }) {
  const t = useTranslations("memory.sources");
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-xl font-semibold">{t("title")}</h2>
      {sources.length === 0 ? (
        <p className="text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {sources.map((source, i) => (
            <li key={i}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{source.title}</a>
              ) : (
                source.title
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
