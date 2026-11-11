"use client";

import { useState } from "react";
import { ScanText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { aiToolsApi, AI_LANGS, type AiLang, type Analysis, type Annotation, type OcrProposal } from "@/lib/api/admin-ai";
import { filesApi } from "@/lib/api/admin-content";
import { localeLabels } from "@/lib/i18n/routing";
import { Badge } from "../kit/badge";
import { ConfirmDialog } from "../kit/dialog";
import { Checkbox, FieldGroup, SelectField, TextareaField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { Notice } from "../kit/notice";
import { Panel } from "../kit/page";

const FOUND = ["dates", "persons", "organizations", "events", "topics"] as const;

/** Выбор языка, на котором ИИ формулирует предложения. */
export function AiLangField({ label, value, onChange }: { label: string; value: AiLang; onChange: (lang: AiLang) => void }) {
  return (
    <SelectField label={label} className="sm:w-44" value={value} onChange={(event) => onChange(event.target.value as AiLang)}>
      {AI_LANGS.map((code) => <option key={code} value={code}>{localeLabels[code].name}</option>)}
    </SelectField>
  );
}

/** Находки ИИ как предложения: сотрудник отмечает поля, и только они записываются (с проверкой версии). */
export function AnalysisPanel({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const t = useTranslations("adminAi.tools.analysis");
  const analyze = useAction("ai");
  const apply = useAction("ai");
  const [lang, setLang] = useState<AiLang>("ru");
  const [result, setResult] = useState<Analysis | null>(null);
  const [useSummary, setUseSummary] = useState(false);
  const [authors, setAuthors] = useState("");
  const [dateText, setDateText] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [applied, setApplied] = useState<string | null>(null);

  const run = () =>
    analyze.run(async () => {
      setResult(await aiToolsApi.analyze(documentId, lang));
      setApplied(null);
      setUseSummary(false);
      setAuthors("");
      setDateText("");
      setPlaces([]);
      setTagIds([]);
      apply.setError(null);
    });

  async function applyChecked() {
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
    if (Object.keys(body).length === 2) return apply.setError(t("nothing"));
    let message = "";
    const done = await apply.run(async () => {
      const saved = await aiToolsApi.apply(documentId, body);
      setResult({ ...result, version: saved.version });
      message = t("applied", { version: saved.version, fields: saved.applied.map((field) => t(`fields.${field}`)).join(", ") });
    });
    if (done) setApplied(message);
  }

  const toggle = (list: string[], setList: (value: string[]) => void, value: string) => setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <Panel title={t("title")} description={t("hint")}>
      <div className="flex flex-wrap items-end gap-3">
        <AiLangField label={t("lang")} value={lang} onChange={setLang} />
        <Button onClick={() => void run()} disabled={disabled || analyze.pending}>
          <Sparkles aria-hidden />
          {t("run")}
        </Button>
      </div>
      <div aria-live="polite" className="space-y-2">
        {analyze.pending && <Notice kind="loading">{t("running")}</Notice>}
        {analyze.error && <Notice kind="error">{analyze.error}</Notice>}
      </div>

      {result && (
        <div className="space-y-5 border-t pt-4">
          <Badge tone="warning">{result.label}</Badge>
          {result.text_chars < 200 && <Notice kind="info">{t("noText")}</Notice>}

          <div className="space-y-4">
            <h3 className="text-base font-bold">{t("proposal")}</h3>
            <Checkbox label={t("summary")} hint={result.summary || t("none")} checked={useSummary} disabled={!result.summary} onChange={(event) => setUseSummary(event.target.checked)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t("authors")} value={authors} onChange={(event) => setAuthors(event.target.value)}>
                <option value="">{t("choose")}</option>
                {result.organizations.concat(result.persons).map((value) => <option key={value} value={value}>{value}</option>)}
              </SelectField>
              <SelectField label={t("dateText")} value={dateText} onChange={(event) => setDateText(event.target.value)}>
                <option value="">{t("choose")}</option>
                {result.dates.map((value) => <option key={value} value={value}>{value}</option>)}
              </SelectField>
              <FieldGroup legend={t("places")}>
                {result.places.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
                {result.places.map((value) => <Checkbox key={value} label={value} checked={places.includes(value)} onChange={() => toggle(places, setPlaces, value)} />)}
              </FieldGroup>
              <FieldGroup legend={t("tags")}>
                {result.tags.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
                {result.tags.map((tag) => <Checkbox key={tag.id} label={tag.name} checked={tagIds.includes(tag.id)} onChange={() => toggle(tagIds, setTagIds, tag.id)} />)}
              </FieldGroup>
            </div>
            <Button onClick={() => void applyChecked()} disabled={apply.pending || disabled}>{apply.pending ? t("applying") : t("apply")}</Button>
            <div aria-live="polite" className="space-y-2">
              {apply.error && <Notice kind="error">{apply.error}</Notice>}
              {applied && !apply.error && <Notice kind="success">{applied}</Notice>}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold">{t("found")}</h3>
            <dl className="divide-y border-y text-sm">
              {FOUND.map((key) => (
                <div key={key} className="grid gap-x-4 py-2 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted-foreground">{t(key)}</dt>
                  <dd className="break-words">{result[key].length ? result[key].join("; ") : t("none")}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-base font-bold">{t("duplicates")}</h3>
              {result.duplicates.length === 0 && <p className="text-sm text-muted-foreground">{t("noDuplicates")}</p>}
              <ul className="divide-y text-sm">
                {result.duplicates.map((item) => (
                  <li key={item.id} className="py-2">
                    <span className="break-words font-medium">{item.title}</span>
                    {item.archive_code && <span className="cipher block text-muted-foreground">{item.archive_code}</span>}
                    <span className="block text-muted-foreground">{t(`duplicateReason.${item.reason}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold">{t("related")}</h3>
              {result.related.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
              <ul className="divide-y text-sm">
                {result.related.map((item) => <li key={item.id} className="break-words py-2">{item.title}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function LangAnnotation({ documentId, lang, annotation, canUseAi, reload }: { documentId: string; lang: AiLang; annotation: Annotation | undefined; canUseAi: boolean; reload: () => void }) {
  const t = useTranslations("adminAi.tools.annotation");
  const action = useAction("ai");
  const [text, setText] = useState(annotation?.text ?? "");
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function act(run: () => Promise<Annotation | void>, success: string) {
    const done = await action.run(async () => {
      const result = await run();
      if (result) setText(result.text);
    }, success);
    setGenerating(false);
    if (done) reload();
  }

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{localeLabels[lang].name}</h3>
        {!annotation ? <Badge>{t("none")}</Badge> : annotation.status === "approved" ? <Badge tone="success">{t("approved")}</Badge> : <Badge tone="warning">{t("draft")}</Badge>}
      </div>
      {annotation && (
        <TextareaField
          label={t("text")}
          hint={[annotation.label, annotation.uses_file_text ? t("fileText") : ""].filter(Boolean).join(" ")}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={action.pending || !canUseAi}
          onClick={() => {
            setGenerating(true);
            void act(() => aiToolsApi.generateAnnotation(documentId, lang), t("generated"));
          }}
        >
          <Sparkles aria-hidden />
          {annotation ? t("regenerate") : t("generate")}
        </Button>
        {annotation && (
          <>
            <Button size="sm" variant="outline" disabled={action.pending || !text.trim() || text === annotation.text} onClick={() => void act(() => aiToolsApi.editAnnotation(documentId, lang, text), t("saved"))}>
              {t("save")}
            </Button>
            <Button size="sm" disabled={action.pending || annotation.status === "approved" || text !== annotation.text} onClick={() => void act(() => aiToolsApi.approveAnnotation(documentId, lang), t("approvedDone"))}>
              {t("approve")}
            </Button>
            <Button size="sm" variant="ghost" disabled={action.pending} onClick={() => setConfirm(true)}>{t("withdraw")}</Button>
          </>
        )}
      </div>
      <div aria-live="polite" className="space-y-2">
        {generating && <Notice kind="loading">{t("generating")}</Notice>}
        {action.error && <Notice kind="error">{action.error}</Notice>}
      </div>
      {confirm && (
        <ConfirmDialog
          danger
          scope="ai"
          title={t("withdrawTitle")}
          description={t("withdrawText")}
          confirmLabel={t("withdraw")}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await aiToolsApi.withdrawAnnotation(documentId, lang);
            setText("");
            reload();
          }}
        />
      )}
    </li>
  );
}

/** Публичная аннотация «Кратко о документе»: черновик ИИ, правка, утверждение сотрудником. */
export function AnnotationPanel({ documentId, canUseAi }: { documentId: string; canUseAi: boolean }) {
  const t = useTranslations("adminAi.tools.annotation");
  const list = useLoad(() => aiToolsApi.annotations(documentId), [documentId], "ai");
  return (
    <Panel title={t("title")} description={t("hint")}>
      {list.error && <Notice kind="error">{list.error}</Notice>}
      {list.data && (
        <ul className="divide-y">
          {AI_LANGS.map((lang) => {
            const annotation = list.data?.find((item) => item.lang === lang);
            // key по updated_at: после правки или генерации поле текста сбрасывается на сохранённое значение
            return <LangAnnotation key={`${lang}-${annotation?.updated_at ?? "new"}`} documentId={documentId} lang={lang} annotation={annotation} canUseAi={canUseAi} reload={list.reload} />;
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Распознанный текст — предложение: в файл он записывается только кнопкой «Сохранить как текст файла». */
function FileOcr({ fileId, name }: { fileId: string; name: string }) {
  const t = useTranslations("adminAi.tools.ocrPanel");
  const action = useAction("ai");
  const [proposal, setProposal] = useState<OcrProposal | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  const run = () =>
    action.run(async () => {
      setSaved(false);
      const result = await aiToolsApi.ocr(fileId);
      setProposal(result);
      setText(result.text);
    });
  const save = async () => setSaved(await action.run(() => aiToolsApi.applyOcr(fileId, text)));

  const reason = proposal?.reason ? (t.has(`reasons.${proposal.reason}`) ? t(`reasons.${proposal.reason}`) : proposal.reason) : "";
  return (
    <li className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-all text-sm font-medium">{name}</span>
        <Button size="sm" variant="outline" onClick={() => void run()} disabled={action.pending}>
          <ScanText aria-hidden />
          {t("run")}
        </Button>
      </div>
      <div aria-live="polite" className="space-y-2">
        {action.pending && <Notice kind="loading">{t("running")}</Notice>}
        {action.error && <Notice kind="error">{action.error}</Notice>}
        {proposal && proposal.status !== "done" && <Notice kind="warning">{t("unavailable", { reason })}</Notice>}
        {saved && <Notice kind="success">{t("applied")}</Notice>}
      </div>
      {proposal?.status === "done" && (
        <>
          <TextareaField label={t("result")} rows={8} value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} />
          <Button size="sm" onClick={() => void save()} disabled={action.pending || !text.trim()}>{t("apply")}</Button>
        </>
      )}
    </li>
  );
}

export function OcrPanel({ documentId }: { documentId: string }) {
  const t = useTranslations("adminAi.tools.ocrPanel");
  const files = useLoad(() => filesApi.list("document", documentId), [documentId], "ai");
  return (
    <Panel title={t("title")} description={t("hint")}>
      {files.error && <Notice kind="error">{files.error}</Notice>}
      {files.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("noFiles")}</p>}
      {files.data && files.data.length > 0 && <ul className="divide-y">{files.data.map((file) => <FileOcr key={file.id} fileId={file.id} name={file.original_name ?? file.id} />)}</ul>}
    </Panel>
  );
}
