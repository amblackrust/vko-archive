"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../confirm-dialog";
import { Notice } from "../notice";
import { useImportError } from "../import/use-import-error";
import { translationsApi, type TranslationLang } from "./translations-api";

interface TextTranslateButtonProps {
  source: TranslationLang;
  target: TranslationLang;
  sourceText: string;
  /** Текст на целевом языке: если он уже есть, перед заменой спрашиваем. */
  targetText: string;
  /** Перевод не сохраняется сам: текст попадает в поле, сохраняет сотрудник вместе с формой. */
  onDone: (text: string) => void;
}

/** «Черновой перевод ИИ» для полей без собственного объекта перевода (настройки сайта). */
export function TextTranslateButton({ source, target, sourceText, targetText, onDone }: TextTranslateButtonProps) {
  const t = useTranslations("adminImport.translations");
  const { describe } = useImportError();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    try {
      onDone((await translationsApi.text(sourceText, source, target)).text);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={pending || source === target} onClick={() => (targetText.trim() ? setConfirm(true) : void run())}>
        <Sparkles aria-hidden />
        {t("machine")}
      </Button>
      {pending && <Notice kind="loading">{t("machineWorking")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("overwriteTitle")}
        description={t("overwriteText")}
        confirmLabel={t("overwrite")}
        danger
        onConfirm={async () => {
          setConfirm(false);
          await run();
        }}
      />
    </div>
  );
}
