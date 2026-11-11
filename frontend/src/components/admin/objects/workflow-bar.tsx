"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can, usersApi } from "@/lib/api/admin";
import { contentApi, type ContentObject, type HistoryEntry } from "@/lib/api/admin-content";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useMe } from "../admin-provider";
import { WorkflowBadge } from "../kit/badge";
import { ConfirmDialog } from "../kit/dialog";
import { TextareaField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { Notice } from "../kit/notice";
import { useToast } from "../kit/toast";

const STEPS = ["draft", "review", "approved", "published"] as const;
const STEP_OF: Record<string, number> = { draft: 0, needs_changes: 0, review: 1, approved: 2, published: 3, archived: -1 };
/** Действия, которые двигают материал вперёд: главная кнопка. Остальные — второстепенные. */
const FORWARD = ["submit", "approve", "publish", "restore"];
/** Действия с окном подтверждения: меняют видимость на сайте или требуют комментария. */
const CONFIRMED = ["return", "publish", "archive", "rework"];
/** Кто выполняет переход: автор материала или согласующий. */
const ACTOR: Record<string, "author" | "reviewer"> = { review: "author", needs_changes: "reviewer", approved: "reviewer", published: "reviewer", archived: "reviewer" };

interface WorkflowBarProps {
  object: ContentObject;
  /** В форме есть несохранённые правки: переходы относятся к сохранённой версии, поэтому недоступны. */
  dirty: boolean;
  /** Подпись поля по имени (для списка изменённых полей в истории). */
  fieldLabel: (name: string) => string;
  /** После перехода: новые версия, статус и доступные действия. */
  onChanged: (patch: Pick<ContentObject, "workflow_status" | "version" | "available_actions">) => void;
}

/**
 * Согласование материала: на каком он этапе, что будет дальше и кто это делает, какие действия доступны
 * текущему сотруднику, история версий. Публикация возможна только отсюда (через workflow API).
 */
export function WorkflowBar({ object, dirty, fieldLabel, onChanged }: WorkflowBarProps) {
  const t = useTranslations("admin.workflow");
  const action = useAction("catalog");
  const toast = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  // Результат перехода для экранного диктора: всплывающее сообщение вне окна он не прочитает.
  const [announced, setAnnounced] = useState("");
  const status = object.workflow_status;
  const step = STEP_OF[status] ?? 0;
  const needsChanges = status === "needs_changes";
  // Замечание проверяющего нужно автору сразу, поэтому историю возвращённого материала читаем без запроса.
  const history = useLoad(
    () => (historyOpen || needsChanges ? contentApi.history(object.kind, object.id) : Promise.resolve(null)),
    [object.kind, object.id, object.version, historyOpen || needsChanges],
    "catalog",
  );
  const remark = needsChanges ? history.data?.findLast((entry) => entry.to_status === "needs_changes" && entry.comment)?.comment : null;

  async function transition(name: string, text?: string) {
    const result = await contentApi.transition(object.kind, object.id, name, object.version, text);
    onChanged(result);
    toast.success(t(`done.${name}`));
    setAnnounced(t(`done.${name}`));
  }

  return (
    <section aria-label={t("title")} className="space-y-4 rounded-lg bg-surface-muted p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold">{t("title")}</h3>
          <WorkflowBadge status={status} />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{t("version", { version: object.version })}</span>
      </div>

      <ol aria-label={t("steps.label")} className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
        {STEPS.map((name, index) => {
          // Опубликованный материал прошёл все этапы: последний отмечен галочкой, а не «текущим».
          const done = step > index || status === "published";
          const current = step === index && !done;
          return (
            <li key={name} aria-current={current ? "step" : undefined} className={cn("border-t-2 pt-2 text-sm", done || current ? "border-primary" : "border-border-strong text-muted-foreground")}>
              <span className="flex items-center gap-1.5">
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums", current && "border-primary bg-primary text-primary-foreground", done && "border-primary text-primary")}>
                  {done ? <Check className="size-3" aria-hidden /> : index + 1}
                </span>
                <span className={cn((current || (done && step === index)) && "font-semibold")}>{t(`steps.${name}`)}</span>
              </span>
              {done && <span className="sr-only">{t("steps.done")}</span>}
            </li>
          );
        })}
      </ol>

      <p className="text-sm">{t(`next.${status in STEP_OF ? status : "draft"}`)}</p>
      {remark && <Notice kind="warning" title={t("remark")}>{remark}</Notice>}

      {object.available_actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noActions")}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {object.available_actions.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={FORWARD.includes(name) ? "primary" : "outline"}
                disabled={action.pending || dirty}
                onClick={() => {
                  if (CONFIRMED.includes(name)) setConfirming(name);
                  else void action.run(() => transition(name));
                }}
              >
                {t(`actions.${name}`)}
              </Button>
            ))}
          </div>
          {dirty && <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>}
          {action.pending && <Notice kind="loading">{t("working")}</Notice>}
        </div>
      )}
      {action.error && <Notice kind="error">{action.error}</Notice>}
      <p role="status" className="sr-only">{announced}</p>

      <div>
        <Button type="button" size="sm" variant="ghost" className="-ml-3" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
          {historyOpen ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          {t("history.title")}
        </Button>
        {historyOpen && history.error && <Notice kind="error">{history.error}</Notice>}
        {historyOpen && !history.data && !history.error && <Notice kind="loading">{t("history.loading")}</Notice>}
        {historyOpen && history.data && <HistoryList entries={history.data} fieldLabel={fieldLabel} />}
      </div>

      {confirming && (
        <ConfirmDialog
          scope="catalog"
          danger={confirming !== "publish"}
          title={t(`confirm.${confirming}.title`)}
          description={t(`confirm.${confirming}.text`)}
          confirmLabel={t(`actions.${confirming}`)}
          confirmDisabled={confirming === "return" && !comment.trim()}
          onClose={() => {
            setConfirming(null);
            setComment("");
          }}
          onConfirm={async () => {
            await transition(confirming, comment);
            action.setError(null);
          }}
        >
          {confirming !== "publish" && (
            <TextareaField
              label={t(confirming === "return" ? "comment.required" : "comment.optional")}
              hint={confirming === "return" ? t("comment.hint") : undefined}
              required={confirming === "return"}
              maxLength={4000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}

/** Имена сотрудников по id — только для тех, кому доступен список пользователей; иначе известен лишь сам сотрудник. */
function useStaffNames(): (id: string | null) => string | null {
  const t = useTranslations("admin.workflow.history");
  const me = useMe();
  const [names, setNames] = useState<Record<string, string>>({});
  const allowed = can(me, "users.view");
  useEffect(() => {
    if (!allowed) return;
    usersApi
      .list({ page: 1, page_size: 100 })
      .then((page) => setNames(Object.fromEntries(page.items.map((user) => [user.id, user.full_name || user.email]))))
      .catch(() => undefined);
  }, [allowed]);
  return (id) => (id === null ? null : id === me.id ? t("you", { name: me.full_name || me.email }) : (names[id] ?? null));
}

/** История версий: версия, дата, что произошло, кто это сделал (автор или согласующий), комментарий. */
function HistoryList({ entries, fieldLabel }: { entries: HistoryEntry[]; fieldLabel: (name: string) => string }) {
  const t = useTranslations("admin.workflow.history");
  const nameOf = useStaffNames();
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ol className="mt-1 max-h-72 divide-y overflow-y-auto rounded-md border bg-surface text-sm">
      {[...entries].reverse().map((entry) => {
        const moved = entry.from_status !== entry.to_status;
        const reworked = entry.from_status === "published" && entry.to_status === "needs_changes";
        const event = entry.from_status === null ? "created" : !moved ? "edited" : reworked ? "rework" : entry.from_status === "archived" ? "restored" : entry.to_status;
        const role = moved && entry.from_status !== null && !reworked ? (ACTOR[entry.to_status] ?? "author") : "author";
        const name = nameOf(entry.user_id);
        const fields = entry.changes.filter((change) => change.field !== "workflow_status").map((change) => fieldLabel(change.field));
        return (
          <li key={entry.id} className="grid gap-x-4 gap-y-1 px-3 py-2.5 sm:grid-cols-[9.5rem_1fr]">
            <p className="tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{t("version", { version: entry.version })}</span>
              <time dateTime={entry.ts} className="block text-xs">{formatDateTime(entry.ts)}</time>
            </p>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(`events.${event}`)}</span>
                {moved && <WorkflowBadge status={entry.to_status} />}
              </p>
              <p className="text-muted-foreground">{name ? t(`by.${role}Named`, { name }) : t(`by.${role}`)}</p>
              {fields.length > 0 && <p className="break-words text-muted-foreground">{t("fields", { fields: fields.join(", ") })}</p>}
              {entry.comment && <p className="break-words border-l-2 border-border-strong pl-2">{entry.comment}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
