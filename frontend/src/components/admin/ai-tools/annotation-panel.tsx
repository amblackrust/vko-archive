"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { aiToolsApi, AI_LANGS, type AiLang, type Annotation } from "@/lib/api/admin-ai";
import { ConfirmDialog } from "../confirm-dialog";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { useAiError } from "./use-ai-error";

function LangAnnotation({ documentId, lang, annotation, canUseAi, reload }: {
  documentId: string; lang: AiLang; annotation: Annotation | undefined; canUseAi: boolean; reload: () => void;
}) {
  const t = useTranslations("adminAi.tools.annotation");
  const describe = useAiError();
  const [text, setText] = useState(annotation?.text ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function act(action: () => Promise<Annotation | void>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await action();
      if (result) setText(result.text);
      setSaved(true);
      reload();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{lang.toUpperCase()}</h3>
        <span className="text-xs text-muted-foreground">
          {annotation ? (annotation.status === "approved" ? t("approved") : t("draft")) : t("none")}
        </span>
      </div>
      {pending && <Notice kind="loading">{t("generating")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {saved && !pending && <Notice kind="success">{t("saved")}</Notice>}
      {annotation && (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            aria-label={`${t("title")} ${lang.toUpperCase()}`}
            className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">{annotation.label}</p>
          {annotation.uses_file_text && <p className="text-xs text-muted-foreground">{t("fileText")}</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending || !canUseAi} onClick={() => void act(() => aiToolsApi.generateAnnotation(documentId, lang))}>
          <Sparkles aria-hidden />
          {annotation ? t("regenerate") : t("generate")}
        </Button>
        {annotation && (
          <>
            <Button size="sm" variant="outline" disabled={pending || !text.trim() || text === annotation.text} onClick={() => void act(() => aiToolsApi.editAnnotation(documentId, lang, text))}>
              {t("save")}
            </Button>
            <Button size="sm" disabled={pending || annotation.status === "approved" || text !== annotation.text} onClick={() => void act(() => aiToolsApi.approveAnnotation(documentId, lang))}>
              {t("approve")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(true)}>{t("withdraw")}</Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("withdrawTitle")}
        description={t("withdrawText")}
        confirmLabel={t("withdraw")}
        danger
        onConfirm={async () => {
          await aiToolsApi.withdrawAnnotation(documentId, lang);
          setText("");
          reload();
        }}
      />
    </li>
  );
}

/** Публичная аннотация «Кратко о документе»: черновик ИИ → правка → утверждение сотрудником. */
export function AnnotationPanel({ documentId, canUseAi }: { documentId: string; canUseAi: boolean }) {
  const t = useTranslations("adminAi.tools.annotation");
  const list = useLoad(() => aiToolsApi.annotations(documentId), [documentId]);
  return (
    <section className="space-y-2 rounded-lg border p-4" aria-labelledby="annotation-title">
      <h2 id="annotation-title" className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {list.error && <Notice kind="error">{list.error}</Notice>}
      {list.data && (
        <ul className="divide-y">
          {AI_LANGS.map((lang) => {
            const annotation = list.data?.find((item) => item.lang === lang);
            // key по updated_at: после правки/генерации поле текста сбрасывается на сохранённое значение
            return <LangAnnotation key={`${lang}-${annotation?.updated_at ?? "new"}`} documentId={documentId} lang={lang} annotation={annotation} canUseAi={canUseAi} reload={list.reload} />;
          })}
        </ul>
      )}
    </section>
  );
}
