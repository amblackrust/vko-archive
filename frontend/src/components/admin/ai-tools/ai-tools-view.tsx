"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/state-view";
import { aiToolsApi } from "@/lib/api/admin-ai";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { AnalysisPanel } from "./analysis-panel";
import { AnnotationPanel } from "./annotation-panel";
import { CollectionDraftPanel } from "./collection-draft";
import { DocumentPicker, type PickedDocument } from "./document-picker";
import { OcrPanel } from "./ocr-panel";

/** Раздел «ИИ-инструменты» (T4.9, T4.10, T6.14): всё, что делает ИИ, — предложения для проверки сотрудником. */
export function AiToolsView() {
  const t = useTranslations("adminAi.tools");
  const me = useMe();
  const status = useLoad(() => aiToolsApi.status(), []);
  const [tab, setTab] = useState<"document" | "collection">("document");
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const canUseAi = can(me, "ai.use");
  const aiOn = status.data?.ai_available === true;

  if (!canUseAi) return <ForbiddenState />;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      {status.error && <Notice kind="error">{status.error}</Notice>}
      {status.data && (
        <div className="space-y-2">
          <Notice kind={aiOn ? "success" : "info"}>{aiOn ? t("aiOn") : t("aiOff")}</Notice>
          <Notice kind="info">{t(`ocr.${status.data.ocr_engine ?? "none"}`)}</Notice>
        </div>
      )}

      <div role="tablist" aria-label={t("title")} className="flex gap-2">
        {(["document", "collection"] as const).map((key) => (
          <Button key={key} role="tab" aria-selected={tab === key} variant={tab === key ? "primary" : "outline"} size="sm" onClick={() => setTab(key)}>
            {t(`tabs.${key}`)}
          </Button>
        ))}
      </div>

      {tab === "collection" && <CollectionDraftPanel canUseAi={aiOn} />}
      {tab === "document" && (
        <div className="space-y-6">
          {document === null ? (
            <DocumentPicker onPick={setDocument} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
                <span>
                  {t("picker.selected")}: <b>{document.title}</b> {document.code && <span className="text-muted-foreground">({document.code})</span>}
                </span>
                <Button size="sm" variant="outline" onClick={() => setDocument(null)}>{t("picker.change")}</Button>
              </div>
              <AnalysisPanel key={`a-${document.id}`} documentId={document.id} disabled={!aiOn} />
              <AnnotationPanel key={`n-${document.id}`} documentId={document.id} canUseAi={aiOn} />
              <OcrPanel key={`o-${document.id}`} documentId={document.id} canRun />
            </>
          )}
        </div>
      )}
    </div>
  );
}
