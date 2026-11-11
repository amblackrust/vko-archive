"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "../kit/form";
import { FIELD_LANGS, LangTabs, type FieldLang } from "../kit/lang-tabs";
import { MachineTranslateButton, TextTranslateButton } from "../translations/translate-buttons";
import type { TranslationDetail, TranslationStatus } from "../translations/translations-api";

/** Сохранённый объект в черновике или на доработке без несохранённых правок: только тогда перевод делает сервер. */
export interface MachineTranslateProps {
  objectType: string;
  objectId: string;
  version: number;
  onDone: (detail: TranslationDetail) => void;
}

interface I18nFieldProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  multiline?: boolean;
  required?: boolean;
  /** Статус перевода по языкам (verified / machine / missing) для пометки вкладок. */
  translationStatus?: Record<string, string>;
  machine?: MachineTranslateProps;
  /** Для значений вне переводимых объектов (настройки сайта): перевод строки без сохранения. */
  textTranslate?: boolean;
}

/** Шапка многоязычного поля: подпись слева, вкладки языков справа. */
export function I18nLabel({ id, label, required, lang, onLang, value, status }: {
  id?: string;
  label: string;
  required?: boolean;
  lang: FieldLang;
  onLang: (lang: FieldLang) => void;
  value: Record<string, string>;
  status?: Record<string, string>;
}) {
  const Tag = id ? "label" : "span";
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <Tag htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden className="text-destructive"> *</span>}
      </Tag>
      <LangTabs lang={lang} onChange={onLang} value={value} status={status} />
    </div>
  );
}

/** Первый заполненный язык, отличный от открытой вкладки: с него предлагается перевод. */
export const translationSource = (value: Record<string, string>, lang: FieldLang) => FIELD_LANGS.find((code) => code !== lang && value[code]?.trim());

/** Поле с вкладками KZ / RU / EN. Пустой язык отправляется как отсутствующий. */
export function I18nField({ label, value, onChange, multiline, required, translationStatus, machine, textTranslate }: I18nFieldProps) {
  const id = useId();
  const [lang, setLang] = useState<FieldLang>("ru");
  const source = translationSource(value, lang);
  const setText = (text: string) => onChange({ ...value, [lang]: text });
  const props = { id, lang, value: value[lang] ?? "", required: required && lang === "ru" && !Object.values(value).some((text) => text?.trim()) };
  return (
    <div className="space-y-1.5">
      <I18nLabel id={id} label={label} required={required} lang={lang} onLang={setLang} value={value} status={translationStatus} />
      {multiline ? (
        <Textarea {...props} rows={5} onChange={(event) => setText(event.target.value)} />
      ) : (
        <Input {...props} onChange={(event) => setText(event.target.value)} />
      )}
      {textTranslate && !machine && source && (
        <TextTranslateButton source={source} target={lang} sourceText={value[source]} targetText={value[lang] ?? ""} onDone={setText} />
      )}
      {machine && source && (
        <MachineTranslateButton {...machine} source={source} target={lang} targetStatus={translationStatus?.[lang] as TranslationStatus | undefined} />
      )}
    </div>
  );
}
