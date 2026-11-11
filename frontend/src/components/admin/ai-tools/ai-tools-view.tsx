"use client";

import { useId, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { aiToolsApi, type AiLang, type CollectionDraft } from "@/lib/api/admin-ai";
import { can, pickName } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { Badge } from "../kit/badge";
import { TextField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { NoAccess, Notice } from "../kit/notice";
import { AdminPage, Panel, TabPanel, Tabs, useTabParam } from "../kit/page";
import { ObjectSearch } from "../objects/object-search";
import { AiLangField, AnalysisPanel, AnnotationPanel, OcrPanel } from "./document-panels";

const TABS = ["document", "collection"] as const;
const DOCUMENT = ["document"] as const;

/** ИИ-инструменты: всё, что делает ИИ, — предложения, которые сотрудник проверяет и подтверждает. */
export function AiToolsView() {
  const t = useTranslations("adminAi.tools");
  const locale = useLocale();
  const me = useMe();
  const panelId = useId();
  const allowed = can(me, "ai.use");
  const status = useLoad(() => (allowed ? aiToolsApi.status() : Promise.resolve(null)), [], "ai");
  const [tab, setTab] = useTabParam(TABS);
  const [document, setDocument] = useState<{ id: string; title: string; code: string | null } | null>(null);
  if (!allowed) return <NoAccess />;
  const aiOn = status.data?.ai_available === true;

  return (
    <AdminPage title={t("title")} lead={t("intro")}>
      {status.error && <Notice kind="error">{status.error}</Notice>}
      {status.data && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Notice kind={aiOn ? "success" : "warning"}>{aiOn ? t("aiOn") : t("aiOff")}</Notice>
          <Notice kind={status.data.ocr_engine ? "success" : "warning"}>{t(`ocr.${status.data.ocr_engine ?? "none"}`)}</Notice>
        </div>
      )}
      <Tabs label={t("title")} panelId={panelId} active={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))} />
      <TabPanel id={panelId} active={tab} className="space-y-5">
        {tab === "collection" && <CollectionDraftPanel disabled={!aiOn} />}
        {tab === "document" && document === null && (
          <Panel title={t("picker.label")} description={t("picker.hint")}>
            <ObjectSearch
              showInitial
              kinds={DOCUMENT}
              label={t("picker.placeholder")}
              pickLabel={t("picker.pick")}
              onPick={(row) => setDocument({ id: row.id, title: pickName(row.title, locale) || "—", code: row.number })}
            />
          </Panel>
        )}
        {tab === "document" && document && (
          <>
            <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
              <p className="min-w-0 text-sm">
                <span className="block text-muted-foreground">{t("picker.selected")}</span>
                <span className="break-words font-semibold">{document.title}</span>
                {document.code && <span className="cipher block text-muted-foreground">{document.code}</span>}
              </p>
              <Button size="sm" variant="outline" onClick={() => setDocument(null)}>{t("picker.change")}</Button>
            </div>
            <AnalysisPanel key={`a-${document.id}`} documentId={document.id} disabled={!aiOn} />
            <AnnotationPanel key={`n-${document.id}`} documentId={document.id} canUseAi={aiOn} />
            <OcrPanel key={`o-${document.id}`} documentId={document.id} />
          </>
        )}
      </TabPanel>
    </AdminPage>
  );
}

/** Черновик тематической подборки: только предложение, нигде не сохраняется. */
function CollectionDraftPanel({ disabled }: { disabled: boolean }) {
  const t = useTranslations("adminAi.tools.collection");
  const action = useAction("ai");
  const [topic, setTopic] = useState("");
  const [lang, setLang] = useState<AiLang>("ru");
  const [draft, setDraft] = useState<CollectionDraft | null>(null);

  return (
    <Panel title={t("title")} description={t("intro")}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => setDraft(await aiToolsApi.draftCollection(topic.trim(), lang)));
        }}
      >
        <TextField label={t("topic")} className="min-w-56 flex-1" placeholder={t("topicPlaceholder")} minLength={3} maxLength={200} required value={topic} onChange={(event) => setTopic(event.target.value)} />
        <AiLangField label={t("lang")} value={lang} onChange={setLang} />
        <Button type="submit" disabled={action.pending || disabled || topic.trim().length < 3}>
          <Sparkles aria-hidden />
          {t("run")}
        </Button>
      </form>
      <div aria-live="polite" className="space-y-4">
        {action.pending && <Notice kind="loading">{t("running")}</Notice>}
        {action.error && <Notice kind="error">{action.error}</Notice>}
        {draft && (
          <div className="space-y-3 border-t pt-4 text-sm">
            <Badge tone="warning">{draft.label}</Badge>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground">{t("draftTitle")}</dt>
                <dd className="font-semibold">{draft.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("draftText")}</dt>
                <dd>{draft.description}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("items")}</dt>
                <dd>
                  <ul className="mt-1 divide-y border-y">
                    {draft.items.map((item) => <li key={item.id} className="py-2">{item.title}</li>)}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Panel>
  );
}
