"use client";

import { useState } from "react";
import { ScanText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { aiToolsApi, type OcrProposal } from "@/lib/api/admin-ai";
import { filesApi } from "@/lib/api/admin-content";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { useAiError } from "./use-ai-error";

/** Распознанный текст — предложение: в файл он записывается только кнопкой «Сохранить». */
function FileOcr({ fileId, name, canRun }: { fileId: string; name: string; canRun: boolean }) {
  const t = useTranslations("adminAi.tools.ocrPanel");
  const describe = useAiError();
  const [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<OcrProposal | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await aiToolsApi.ocr(fileId);
      setProposal(result);
      setText(result.text);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      await aiToolsApi.applyOcr(fileId, text);
      setSaved(true);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  const reason = proposal?.reason ? (t.has(`reasons.${proposal.reason}`) ? t(`reasons.${proposal.reason}`) : proposal.reason) : "";
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium break-all">{name}</span>
        <Button size="sm" variant="outline" onClick={() => void run()} disabled={!canRun || pending}>
          <ScanText aria-hidden />
          {t("run")}
        </Button>
      </div>
      {pending && <Notice kind="loading">{t("running")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {proposal && proposal.status !== "done" && <Notice kind="info">{t("unavailable", { reason })}</Notice>}
      {proposal?.status === "done" && (
        <div className="space-y-2">
          <label className="block space-y-1.5 text-sm font-medium">
            {t("result")}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              className="w-full rounded-md border bg-surface px-3 py-2 text-sm font-normal"
            />
          </label>
          <Button size="sm" onClick={() => void save()} disabled={pending || !text.trim()}>{t("apply")}</Button>
          {saved && <Notice kind="success">{t("applied")}</Notice>}
        </div>
      )}
    </li>
  );
}

export function OcrPanel({ documentId, canRun }: { documentId: string; canRun: boolean }) {
  const t = useTranslations("adminAi.tools.ocrPanel");
  const files = useLoad(() => filesApi.list("document", documentId), [documentId]);
  return (
    <section className="space-y-2 rounded-lg border p-4" aria-labelledby="ocr-title">
      <h2 id="ocr-title" className="text-lg font-semibold">{t("title")}</h2>
      {files.error && <Notice kind="error">{files.error}</Notice>}
      {files.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("noFiles")}</p>}
      <ul className="divide-y">
        {files.data?.map((file) => <FileOcr key={file.id} fileId={file.id} name={file.original_name ?? file.id} canRun={canRun} />)}
      </ul>
    </section>
  );
}
