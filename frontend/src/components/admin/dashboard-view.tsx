"use client";

import { Activity, ClipboardCheck, Database, FileText, Files, FolderTree, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi, type ComponentState } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import { useMe } from "./admin-provider";
import { Notice } from "./notice";
import { useLoad } from "./use-load";

const HEALTH_STYLE: Record<ComponentState, string> = {
  ok: "bg-accent-soft text-accent-soft-foreground",
  degraded: "bg-warning-soft text-warning-soft-foreground",
  unavailable: "bg-destructive text-destructive-foreground",
};

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function HealthBlock() {
  const t = useTranslations("admin.dashboard.health");
  const { data, loading, error, reload } = useLoad(() => dashboardApi.health(), []);
  const rows = data
    ? ([
        ["db", data.db.status],
        ["ollama", data.ollama.status],
        ["index", data.embeddings.status],
      ] as const)
    : [];
  return (
    <Card title={t("title")} icon={Activity}>
      {loading && !data && <Skeleton className="h-20 w-full" />}
      {error && (
        <Notice kind="error" action={<Button size="sm" variant="outline" onClick={reload}>{t("retry")}</Button>}>
          {t("error")}
        </Notice>
      )}
      <ul className="space-y-1.5 text-sm">
        {rows.map(([key, state]) => (
          <li key={key} className="flex items-center justify-between gap-2">
            <span>{t(key)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", HEALTH_STYLE[state])}>{t(`state.${state}`)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DashboardView() {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();
  const me = useMe();
  const { data, loading, error, reload } = useLoad(() => dashboardApi.get(), []);

  const counters = data?.counters;
  const stats = counters
    ? [
        { key: "funds", icon: FolderTree, value: counters.funds },
        { key: "inventories", icon: Files, value: counters.inventories },
        { key: "cases", icon: Files, value: counters.cases },
        { key: "documents", icon: FileText, value: counters.documents },
        { key: "documentsPublished", icon: FileText, value: counters.documents_published },
        { key: "users", icon: Users, value: counters.users },
      ].filter((stat) => stat.value !== null)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("greeting", { name: me.full_name || me.email })}</p>
      {error && (
        <Notice kind="error" action={<Button size="sm" variant="outline" onClick={reload}>{t("retry")}</Button>}>
          {error}
        </Notice>
      )}
      {loading && !data && !error && <Skeleton className="h-28 w-full" />}
      {data && !counters && !data.review_tasks && !data.recent_actions && <Notice kind="info">{t("nothing")}</Notice>}
      {stats.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map(({ key, icon: Icon, value }) => (
            <li key={key} className="rounded-lg border bg-surface p-4">
              <Icon className="size-4 text-primary" aria-hidden />
              <p className="mt-2 text-2xl font-semibold">{value?.toLocaleString(locale)}</p>
              <p className="text-xs text-muted-foreground">{t(`counters.${key}`)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.review_tasks && (
          <Card title={t("review.title", { count: data.review_total ?? 0 })} icon={ClipboardCheck}>
            {data.review_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("review.empty")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.review_tasks.map((task) => (
                  <li key={`${task.object_type}-${task.object_id}`} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 rounded bg-surface-muted px-1.5 py-0.5 text-xs">{t(`objectTypes.${task.object_type}`)}</span>
                      {task.title}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={task.updated_at}>
                      {new Date(task.updated_at).toLocaleDateString(locale)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {data?.recent_actions && (
          <Card title={t("recent.title")} icon={Database}>
            {data.recent_actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recent.empty")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.recent_actions.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      <code className="text-xs">{entry.action_type}</code>
                      {entry.result !== "success" && (
                        <span className="ml-2 text-xs font-medium text-destructive">{t(`recent.result.${entry.result}`)}</span>
                      )}
                      <span className="ml-2 text-muted-foreground">{entry.actor ?? "—"}</span>
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.ts}>
                      {new Date(entry.ts).toLocaleString(locale)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <HealthBlock />
      </div>
    </div>
  );
}
