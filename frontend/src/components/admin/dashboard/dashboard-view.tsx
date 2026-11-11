"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { KeyFacts } from "@/components/ui/facts";
import { Skeleton } from "@/components/ui/skeleton";
import { can, dashboardApi, notificationsApi, type ComponentState } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import { Link } from "@/lib/i18n/navigation";
import { useMe } from "../admin-provider";
import { useActionLabel } from "../kit/action-label";
import { Badge, type Tone } from "../kit/badge";
import { RowTitle } from "../kit/data-table";
import { useLoad } from "../kit/hooks";
import { EmptyState, LoadError } from "../kit/notice";
import { AdminPage, Panel } from "../kit/page";
import { notificationTarget, notificationText } from "../notification-bell";
import { ObjectDialog } from "../objects/object-dialog";
import { KINDS } from "../objects/specs";

const HEALTH: Record<ComponentState, Tone> = { ok: "success", degraded: "warning", unavailable: "danger" };
const QUICK = [
  { id: "content", href: "/admin/content", anyOf: ["content.view"] },
  { id: "catalog", href: "/admin/catalog", anyOf: ["catalog.view"] },
  { id: "import", href: "/admin/import", anyOf: ["catalog.import", "catalog.export"] },
  { id: "translations", href: "/admin/translations", anyOf: ["catalog.view", "content.view", "branches.view"] },
] as const;
const DUTIES = ["workflow.submit", "workflow.review", "workflow.publish"] as const;
const COUNTERS = ["funds", "inventories", "cases", "documents", "documents_published", "users"] as const;

const rowClass = "grid gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:px-6";

/** Обзор: что ждёт действий сотрудника, что происходило недавно и работают ли база, ИИ и поиск. */
export function DashboardView() {
  const t = useTranslations("admin.dashboard");
  const types = useTranslations("admin.objectTypes");
  const locale = useLocale();
  const me = useMe();
  const actionLabel = useActionLabel();
  const board = useLoad(() => dashboardApi.get(), []);
  const inbox = useLoad(() => notificationsApi.list(true), []);
  const health = useLoad(() => dashboardApi.health(), []);
  const [target, setTarget] = useState<{ kind: string; id: string } | null>(null);
  const data = board.data;
  const unread = inbox.data?.items.filter((item) => !item.is_read) ?? [];
  const duties = DUTIES.filter((permission) => can(me, permission));
  const refresh = () => {
    board.reload();
    inbox.reload();
  };
  // Открытое уведомление считается прочитанным, как и в колокольчике.
  const openNotice = (id: number, link: { kind: string; id: string }) => {
    setTarget(link);
    void notificationsApi.read(id).then(inbox.reload, () => undefined);
  };

  const quick = QUICK.filter((item) => item.anyOf.some((permission) => can(me, permission)));
  const counters = data?.counters;

  return (
    <AdminPage title={t("title")} lead={t("lead")}>
      {board.error && <LoadError message={board.error} onRetry={board.reload} />}

      {counters && (
        <KeyFacts items={COUNTERS.filter((key) => counters[key] !== null).map((key) => ({ label: t(`counters.${key}`), value: counters[key]!.toLocaleString("ru-RU") }))} />
      )}

      {quick.length > 0 && (
        <nav aria-label={t("quick.title")}>
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quick.map(({ id, href }) => (
              <li key={id}>
                <Link href={href} className="card lift group flex h-full items-start justify-between gap-3 p-5">
                  <span className="min-w-0">
                    <span className="block font-semibold group-hover:text-primary">{t(`quick.${id}.title`)}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{t(`quick.${id}.text`)}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {board.loading && !data && <Skeleton className="h-40 w-full bg-border" />}
      <div className="grid gap-5 lg:grid-cols-2">
        {data?.review_tasks && (
          <Panel title={t("review.title", { count: data.review_total ?? 0 })} description={t("review.text")} flush className="h-full">
            {data.review_tasks.length === 0 ? (
              <EmptyState title={t("review.empty")}>{t("review.emptyHint")}</EmptyState>
            ) : (
              <ul className="divide-y">
                {data.review_tasks.map((task) => (
                  <li key={`${task.object_type}-${task.object_id}`} className={rowClass}>
                    <span className="min-w-0">
                      {task.object_type in KINDS ? (
                        <RowTitle onClick={() => setTarget({ kind: task.object_type, id: task.object_id })}>{task.title}</RowTitle>
                      ) : (
                        <span className="break-words font-semibold">{task.title}</span>
                      )}
                      <span className="block text-muted-foreground">{types.has(task.object_type) ? types(task.object_type) : task.object_type}</span>
                    </span>
                    <time className="tabular-nums text-muted-foreground" dateTime={task.updated_at}>{formatDateTime(task.updated_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title={t("inbox.title", { count: unread.length })} description={t("inbox.text")} flush className="h-full">
          {inbox.error ? (
            <div className="p-4"><LoadError message={inbox.error} onRetry={inbox.reload} /></div>
          ) : unread.length === 0 ? (
            <EmptyState title={t("inbox.empty")}>{t(can(me, "workflow.submit") ? "inbox.emptyAuthor" : "inbox.emptyHint")}</EmptyState>
          ) : (
            <ul className="divide-y">
              {unread.map((item) => {
                const link = notificationTarget(item);
                return (
                  <li key={item.id} className={rowClass}>
                    <span className="min-w-0">
                      {link ? <RowTitle onClick={() => openNotice(item.id, link)}>{notificationText(item, locale)}</RowTitle> : <span className="font-semibold">{notificationText(item, locale)}</span>}
                      {item.object_type && types.has(item.object_type) && <span className="block text-muted-foreground">{types(item.object_type)}</span>}
                    </span>
                    <time className="tabular-nums text-muted-foreground" dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {data?.recent_actions && (
          <Panel title={t("recent.title")} actions={<Link href="/admin/audit" className="text-link text-sm font-medium">{t("recent.all")}</Link>} flush>
            {data.recent_actions.length === 0 ? (
              <EmptyState title={t("recent.empty")} />
            ) : (
              <ul className="divide-y">
                {data.recent_actions.map((entry) => (
                  <li key={entry.id} className={rowClass}>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold" title={entry.action_type}>
                        {actionLabel(entry.action_type)}
                        {entry.result !== "success" && <Badge tone="danger">{t(`recent.result.${entry.result}`)}</Badge>}
                      </span>
                      <span className="block break-all text-muted-foreground">{entry.actor ?? t("recent.system")}</span>
                    </span>
                    <time className="tabular-nums text-muted-foreground" dateTime={entry.ts}>{formatDateTime(entry.ts)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <div className="min-w-0 space-y-5">
          <Panel title={t("health.title")} description={t("health.text")}>
            {health.error && <LoadError message={t("health.error")} onRetry={health.reload} />}
            {health.loading && !health.data && <Skeleton className="h-24 w-full" />}
            {health.data && (
              <ul className="-my-2 divide-y text-[0.9375rem]">
                {([["db", health.data.db.status], ["ollama", health.data.ollama.status], ["index", health.data.embeddings.status]] as const).map(([key, state]) => (
                  <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                    <span>{t(`health.${key}`)}</span>
                    <Badge tone={HEALTH[state]}>{t(`health.state.${state}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {duties.length > 0 && (
            <Panel title={t("duties.title")}>
              <ul className="space-y-2.5 text-[0.9375rem]">
                {duties.map((permission) => (
                  <li key={permission} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {t(`duties.${permission.split(".")[1]}`)}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
      {target && <ObjectDialog key={`${target.kind}-${target.id}`} kind={target.kind} id={target.id} onClose={() => setTarget(null)} onSaved={refresh} />}
    </AdminPage>
  );
}
