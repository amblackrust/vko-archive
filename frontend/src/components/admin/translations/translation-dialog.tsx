"use client";

import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormField, Select } from "../form-field";
import { Notice } from "../notice";
import { useImportError } from "../import/use-import-error";
import { MachineTranslateButton } from "./machine-translate-button";
import { TranslationStatusBadge } from "./translation-status-badge";
import { TRANSLATION_LANGS, translationsApi, type TranslationDetail, type TranslationLang } from "./translations-api";

interface TranslationDialogProps {
  objectType: string;
  objectId: string | null;
  onClose: () => void;
  /** Объект изменён (машинный перевод или проверка) — обновить список. */
  onChanged: () => void;
}

/** Переводы одного материала: исходный и целевой язык рядом, черновой перевод ИИ, отметка «проверено». */
export function TranslationDialog({ objectType, objectId, onClose, onChanged }: TranslationDialogProps) {
  const t = useTranslations("adminImport.translations");
  const { describe } = useImportError();
  const id = useId();
  const [detail, setDetail] = useState<TranslationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TranslationLang>("ru");
  const [target, setTarget] = useState<TranslationLang>("kk");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!objectId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setVerified(false);
    translationsApi
      .get(objectType, objectId)
      .then((result) => !cancelled && setDetail(result))
      .catch((caught) => !cancelled && setError(describe(caught)));
    return () => {
      cancelled = true;
    };
    // describe пересоздаётся каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectType, objectId]);

  function changed(next: TranslationDetail) {
    setDetail(next);
    onChanged();
  }

  async function verify() {
    if (!detail) return;
    setVerifying(true);
    setError(null);
    try {
      changed(await translationsApi.verify(objectType, detail.id, target, detail.version));
      setVerified(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setVerifying(false);
    }
  }

  const targetStatus = detail?.translation_status[target];

  return (
    <Dialog.Root open={objectId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-lg border bg-surface p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{t("dialogTitle")}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{detail?.label ?? "…"}</Dialog.Description>
          {error && <Notice kind="error">{error}</Notice>}
          {!detail && !error && <Notice kind="loading">…</Notice>}
          {detail && (
            <>
              <div className="flex flex-wrap gap-1">
                {TRANSLATION_LANGS.map((lang) => (
                  <TranslationStatusBadge key={lang} lang={lang} status={detail.translation_status[lang]} />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t("source")} htmlFor={`${id}-source`}>
                  <Select id={`${id}-source`} value={source} onChange={(e) => setSource(e.target.value as TranslationLang)}>
                    {TRANSLATION_LANGS.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                  </Select>
                </FormField>
                <FormField label={t("target")} htmlFor={`${id}-target`}>
                  <Select id={`${id}-target`} value={target} onChange={(e) => { setTarget(e.target.value as TranslationLang); setVerified(false); }}>
                    {TRANSLATION_LANGS.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                  </Select>
                </FormField>
              </div>
              <dl className="space-y-3">
                {Object.entries(detail.fields).map(([field, values]) => (
                  <div key={field} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                    <dt className="text-xs font-medium text-muted-foreground sm:col-span-2">
                      {t.has(`fieldNames.${field}`) ? t(`fieldNames.${field}`) : field}
                    </dt>
                    {[source, target].map((lang, index) => (
                      <dd key={`${lang}-${index}`} lang={lang} className="whitespace-pre-wrap break-words text-sm">
                        <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">{lang}</span>
                        {values[lang] || <span className="text-muted-foreground">{t("empty")}</span>}
                      </dd>
                    ))}
                  </div>
                ))}
              </dl>
              {detail.can_machine_translate ? (
                <MachineTranslateButton
                  objectType={objectType}
                  objectId={detail.id}
                  version={detail.version}
                  source={source}
                  target={target}
                  targetStatus={targetStatus}
                  onDone={changed}
                />
              ) : (
                <Notice kind="info">{t("onlyDraft")}</Notice>
              )}
              {targetStatus === "machine" && (
                <Button onClick={verify} disabled={verifying}>
                  <CheckCircle2 aria-hidden />
                  {t("verify", { lang: target.toUpperCase() })}
                </Button>
              )}
              {verified && <Notice kind="success">{t("verifyDone")}</Notice>}
            </>
          )}
          <div className="flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">{t("close")}</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
