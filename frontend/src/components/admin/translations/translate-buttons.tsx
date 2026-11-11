"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "../kit/dialog";
import { useAction } from "../kit/hooks";
import { Notice } from "../kit/notice";
import { useToast } from "../kit/toast";
import { translationsApi, type TranslationDetail, type TranslationLang, type TranslationStatus } from "./translations-api";

/** Кнопка чернового перевода ИИ с ходом выполнения, ошибкой и вопросом о замене готового текста. */
function TranslateButton({ disabled, askFirst, run, hint, success }: {
  disabled: boolean;
  /** На целевом языке уже есть проверенный или введённый текст: перед заменой спрашиваем. */
  askFirst: boolean;
  run: (overwrite: boolean) => Promise<void>;
  hint?: string;
  /** Сообщение об успешном переводе. */
  success?: string;
}) {
  const t = useTranslations("adminImport.translations");
  const action = useAction("import");
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const translate = async (overwrite: boolean) => {
    await run(overwrite);
    if (success) toast.success(success);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" size="sm" disabled={disabled || action.pending} onClick={() => (askFirst ? setConfirm(true) : void action.run(() => translate(false)))}>
          <Sparkles aria-hidden />
          {t("machine")}
        </Button>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div aria-live="polite">
        {action.pending && <Notice kind="loading">{t("machineWorking")}</Notice>}
        {action.error && <Notice kind="error">{action.error}</Notice>}
      </div>
      {confirm && (
        <ConfirmDialog
          danger
          scope="import"
          title={t("overwriteTitle")}
          description={t("overwriteText")}
          confirmLabel={t("overwrite")}
          onClose={() => setConfirm(false)}
          onConfirm={() => translate(true)}
        />
      )}
    </div>
  );
}

interface MachineTranslateButtonProps {
  objectType: string;
  objectId: string;
  /** Текущая версия объекта (оптимистическая блокировка). */
  version: number;
  source: TranslationLang;
  target: TranslationLang;
  /** Статус целевого языка: проверенный перевод заменяется только после подтверждения. */
  targetStatus?: TranslationStatus;
  /** Сохранённый объект с новыми текстами, статусом «машинный» и версией. */
  onDone: (detail: TranslationDetail) => void;
}

/**
 * Черновой перевод материала: его делает сервер через локальную модель и сам сохраняет с пометкой «машинный».
 * Без модели — понятная ошибка с причиной.
 */
export function MachineTranslateButton({ objectType, objectId, version, source, target, targetStatus, onDone }: MachineTranslateButtonProps) {
  const t = useTranslations("adminImport.translations");
  return (
    <TranslateButton
      disabled={source === target}
      askFirst={targetStatus === "verified"}
      hint={t("machineHint")}
      success={t("machineDone")}
      run={async (overwrite) => onDone(await translationsApi.machine({ objectType, objectId, version, source, target, overwrite }))}
    />
  );
}

/** Черновой перевод строки для полей без собственного объекта перевода (настройки сайта): текст попадает в поле, сохраняет сотрудник. */
export function TextTranslateButton({ source, target, sourceText, targetText, onDone }: {
  source: TranslationLang;
  target: TranslationLang;
  sourceText: string;
  targetText: string;
  onDone: (text: string) => void;
}) {
  return (
    <TranslateButton
      disabled={source === target}
      askFirst={Boolean(targetText.trim())}
      run={async () => onDone((await translationsApi.text(sourceText, source, target)).text)}
    />
  );
}
