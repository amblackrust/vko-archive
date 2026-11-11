"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../confirm-dialog";
import { Notice } from "../notice";
import { useImportError } from "../import/use-import-error";
import { translationsApi, type TranslationDetail, type TranslationLang, type TranslationStatus } from "./translations-api";

interface MachineTranslateButtonProps {
  objectType: string;
  objectId: string;
  /** Текущая версия объекта (оптимистическая блокировка). */
  version: number;
  source: TranslationLang;
  target: TranslationLang;
  /** Статус целевого языка: если "verified", сначала спрашиваем о перезаписи. */
  targetStatus?: TranslationStatus;
  disabled?: boolean;
  /** Сохранённый объект с новыми текстами, статусом "machine" и версией. */
  onDone: (detail: TranslationDetail) => void;
}

/**
 * Кнопка «Черновой перевод ИИ» (T6.11). Перевод делает сервер через локальную Ollama и сам
 * сохраняет его с пометкой machine; без Ollama — понятная ошибка с причиной.
 */
export function MachineTranslateButton({
  objectType, objectId, version, source, target, targetStatus, disabled, onDone,
}: MachineTranslateButtonProps) {
  const t = useTranslations("adminImport.translations");
  const { describe } = useImportError();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function run(overwrite: boolean) {
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      onDone(await translationsApi.machine({ objectType, objectId, version, source, target, overwrite }));
      setSuccess(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={disabled || pending || source === target}
        onClick={() => (targetStatus === "verified" ? setConfirm(true) : void run(false))}
      >
        <Sparkles aria-hidden />
        {t("machine")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("machineHint")}</p>
      {pending && <Notice kind="loading">{t("machineWorking")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{t("machineDone")}</Notice>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("overwriteTitle")}
        description={t("overwriteText")}
        confirmLabel={t("overwrite")}
        danger
        onConfirm={async () => {
          setConfirm(false);
          await run(true);
        }}
      />
    </div>
  );
}
