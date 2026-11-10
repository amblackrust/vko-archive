import { useTranslations } from "next-intl";
import { fileUrl } from "@/lib/api/document";
import type { DocumentAiSource } from "./api";

const MARKER_RE = /\[S(\d{1,3})\]/g;

/**
 * Ответ как plain text (никакого HTML от модели). Метки [Sn] становятся ссылками
 * «лист N» на файл листа (/api/files/{id}, ссылку строит сервер по file_id) или
 * пометкой «описание»; метки без источника не показываются.
 */
export function AnswerText({ text, sources }: { text: string; sources: DocumentAiSource[] }) {
  const t = useTranslations("aiDocument.panel");
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER_RE)) {
    parts.push(text.slice(last, match.index));
    last = match.index + match[0].length;
    const source = byRef.get(`S${match[1]}`);
    if (!source) continue;
    const key = `${match.index}-${source.ref}`;
    if (source.page !== null && source.file_id) {
      parts.push(
        <a
          key={key}
          href={fileUrl(`/api/files/${source.file_id}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-0.5 inline-block rounded border px-1.5 text-xs font-medium text-primary hover:underline"
        >
          {t("sheet", { page: source.page })}
        </a>,
      );
    } else {
      parts.push(
        <span key={key} className="mx-0.5 inline-block rounded border px-1.5 text-xs text-muted-foreground">
          {t("descriptionSource")}
        </span>,
      );
    }
  }
  parts.push(text.slice(last));
  return <p className="whitespace-pre-line">{parts}</p>;
}
