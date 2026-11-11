"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { aiToolsApi, AI_LANGS, type AiLang, type Analysis } from "@/lib/api/admin-ai";
import { Select } from "../form-field";
import { Notice } from "../notice";
import { useAiError } from "./use-ai-error";

const FOUND = ["dates", "persons", "organizations", "events", "topics"] as const;

/** Находки ИИ как предложения: сотрудник отмечает поля, и только они записываются (с проверкой версии). */
export function AnalysisPanel({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const t = useTranslations("adminAi.tools.analysis");
  const describe = useAiError();
  const [lang, setLang] = useState<AiLang>("ru");
  const [result, setResult] = useState<Analysis | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [useSummary, setUseSummary] = useState(false);
  const [authors, setAuthors] = useState("");
  const [dateText, setDateText] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const data = await aiToolsApi.analyze(documentId, lang);
      setResult(data);
      setUseSummary(false);
      setAuthors("");
      setDateText("");
      setPlaces([]);
      setTagIds([]);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  async function apply() {
    if (!result) return;
    const body = {
      version: result.version,
      lang,
      ...(useSummary && result.summary ? { summary: result.summary } : {}),
      ...(authors ? { authors } : {}),
      ...(dateText ? { date_text: dateText } : {}),
      ...(places.length ? { places } : {}),
      ...(tagIds.length ? { tag_ids: tagIds } : {}),
    };
    if (Object.keys(body).length === 2) {
      setError(t("nothing"));
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const done = await aiToolsApi.apply(documentId, body);
      setResult({ ...result, version: done.version });
      setMessage(t("applied", { version: done.version, fields: done.applied.map((field) => t(`fields.${field}`)).join(", ") }));
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setApplying(false);
    }
  }

  const toggle = (list: string[], setList: (value: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby="analysis-title">
      <h2 id="analysis-title" className="text-lg font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium">
          {t("lang")}
          <Select value={lang} onChange={(event) => setLang(event.target.value as AiLang)} className="w-28 font-normal">
            {AI_LANGS.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
          </Select>
        </label>
        <Button onClick={() => void run()} disabled={disabled || pending}>
          <Sparkles aria-hidden />
          {t("run")}
        </Button>
      </div>
      {pending && <Notice kind="loading">{t("running")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      {result && (
        <div className="space-y-5">
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">{result.label}</p>
          {result.text_chars < 200 && <Notice kind="info">{t("noText")}</Notice>}
          <h3 className="font-medium">{t("proposal")}</h3>

          <div className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={useSummary} onChange={(event) => setUseSummary(event.target.checked)} disabled={!result.summary} />
              <span><b>{t("summary")}:</b> {result.summary || t("none")}</span>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              {t("authors")}
              <Select value={authors} onChange={(event) => setAuthors(event.target.value)} className="font-normal">
                <option value="">{t("choose")}</option>
                {result.organizations.concat(result.persons).map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              {t("dateText")}
              <Select value={dateText} onChange={(event) => setDateText(event.target.value)} className="font-normal">
                <option value="">{t("choose")}</option>
                {result.dates.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </label>
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">{t("places")}</legend>
              {result.places.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
              {result.places.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={places.includes(value)} onChange={() => toggle(places, setPlaces, value)} />
                  {value}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">{t("tags")}</legend>
              {result.tags.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
              {result.tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => toggle(tagIds, setTagIds, tag.id)} />
                  {tag.name}
                </label>
              ))}
            </fieldset>
            <Button onClick={() => void apply()} disabled={applying || disabled}>
              {applying ? t("applying") : t("apply")}
            </Button>
          </div>

          <div className="space-y-1 text-sm">
            <h3 className="font-medium">{t("found")}</h3>
            {FOUND.map((key) => (
              <p key={key}>
                <span className="text-muted-foreground">{t(key)}: </span>
                {result[key].length ? result[key].join("; ") : t("none")}
              </p>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 font-medium">{t("duplicates")}</h3>
              {result.duplicates.length === 0 && <p className="text-sm text-muted-foreground">{t("noDuplicates")}</p>}
              <ul className="space-y-1 text-sm">
                {result.duplicates.map((item) => (
                  <li key={item.id}>
                    {item.title} {item.archive_code && <span className="text-muted-foreground">({item.archive_code})</span>}
                    <span className="block text-xs text-muted-foreground">{t(`duplicateReason.${item.reason}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-medium">{t("related")}</h3>
              <ul className="space-y-1 text-sm">
                {result.related.map((item) => <li key={item.id}>{item.title}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
