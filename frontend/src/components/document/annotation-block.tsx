import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { DocumentAnnotation } from "@/lib/api/document";

/**
 * «Кратко о документе» (T4.10): аннотация ИИ, которую утвердил сотрудник архива.
 * Всегда с пометкой ИИ и текстом метки с сервера. Текст — обычный, без разметки.
 */
export async function AnnotationBlock({ annotation }: { annotation: DocumentAnnotation }) {
  const t = await getTranslations("aiDocument.annotation");
  return (
    <section aria-labelledby="annotation-title" className="space-y-2 rounded-lg border bg-surface-muted p-4">
      <h2 id="annotation-title" className="flex flex-wrap items-center gap-2 text-xl font-semibold">
        {t("title")}
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">
          <Sparkles className="size-3" aria-hidden />
          {t("badge")}
        </span>
      </h2>
      <p className="whitespace-pre-line" lang={annotation.lang}>{annotation.text}</p>
      <p className="text-xs text-muted-foreground">{annotation.label}. {t("note")}</p>
    </section>
  );
}
