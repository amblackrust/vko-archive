"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiToolsApi, AI_LANGS, type AiLang, type CollectionDraft } from "@/lib/api/admin-ai";
import { Select } from "../form-field";
import { Notice } from "../notice";
import { useAiError } from "./use-ai-error";

/** Черновик тематической подборки: только предложение, нигде не сохраняется. */
export function CollectionDraftPanel({ canUseAi }: { canUseAi: boolean }) {
  const t = useTranslations("adminAi.tools.collection");
  const describe = useAiError();
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState<AiLang>("ru");
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      setDraft(await aiToolsApi.draftCollection(topic.trim(), lang));
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby="collection-title">
      <h2 id="collection-title" className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <form onSubmit={(event) => void run(event)} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
          {t("topic")}
          <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t("topicPlaceholder")} minLength={3} maxLength={200} required className="font-normal" />
        </label>
        <Select value={lang} onChange={(event) => setLang(event.target.value as AiLang)} aria-label="lang" className="w-24">
          {AI_LANGS.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
        </Select>
        <Button type="submit" disabled={pending || !canUseAi || topic.trim().length < 3}>
          <Sparkles aria-hidden />
          {t("run")}
        </Button>
      </form>
      {pending && <Notice kind="loading">{t("running")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {draft && (
        <div className="space-y-3 text-sm">
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">{draft.label}</p>
          <p><b>{t("draftTitle")}:</b> {draft.title}</p>
          <p><b>{t("draftText")}:</b> {draft.description}</p>
          <div>
            <b>{t("items")}:</b>
            <ul className="mt-1 list-disc pl-5">
              {draft.items.map((item) => <li key={item.id}>{item.title}</li>)}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
