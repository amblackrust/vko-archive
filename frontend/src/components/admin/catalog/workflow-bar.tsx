"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { contentApi, type ContentObject, type HistoryEntry } from "@/lib/api/admin-content";
import { Notice } from "../notice";
import { useCatalogError } from "./use-catalog-error";

interface WorkflowBarProps {
  object: ContentObject;
  /** После перехода: новые версия, статус и доступные действия. */
  onChanged: (patch: Pick<ContentObject, "workflow_status" | "version" | "available_actions">) => void;
}

/** Статус публикации и переходы согласования. Публикация возможна только здесь (через workflow API). */
export function WorkflowBar({ object, onChanged }: WorkflowBarProps) {
  const t = useTranslations("adminCatalog");
  const locale = useLocale();
  const describe = useCatalogError();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  async function run(action: string) {
    setPending(true);
    setError(null);
    try {
      const result = await contentApi.transition(object.kind, object.id, action, object.version, comment);
      setComment("");
      onChanged(result);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setPending(false);
    }
  }

  async function toggleHistory() {
    if (history) return setHistory(null);
    try {
      setHistory(await contentApi.history(object.kind, object.id));
    } catch (caught) {
      setError(describe(caught));
    }
  }

  return (
    <section aria-label={t("workflow.title")} className="space-y-3 rounded-md border bg-surface-muted p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          {t("workflow.status")}: <strong>{t(`status.${object.workflow_status}`)}</strong> · v{object.version}
        </span>
        {object.available_actions.map((action) => (
          <Button key={action} type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(action)}>
            {t(`actions.${action}`)}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={toggleHistory}>
          <History aria-hidden />
          {t("workflow.history")}
        </Button>
      </div>
      {object.available_actions.length > 0 && (
        <input
          className="h-9 w-full rounded-md border bg-surface px-3 text-sm"
          placeholder={t("workflow.comment")}
          aria-label={t("workflow.comment")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      {error && <Notice kind="error">{error}</Notice>}
      {history && (
        <ol className="max-h-48 space-y-1 overflow-y-auto text-xs">
          {history.map((entry) => (
            <li key={entry.id}>
              v{entry.version} · {new Date(entry.ts).toLocaleString(locale)} · {entry.from_status ? t(`status.${entry.from_status}`) : "—"} →{" "}
              {t(`status.${entry.to_status}`)}
              {entry.changes.length > 0 && ` · ${entry.changes.map((change) => change.field).join(", ")}`}
              {entry.comment && ` · «${entry.comment}»`}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
