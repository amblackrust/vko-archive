"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/api/admin";
import { analyticsApi, type AiLang, type AiSummary, type AnalyticsReport, type QueryStat } from "@/lib/api/admin-ai";
import { formatIsoDate } from "@/lib/dates";
import { useMe } from "../admin-provider";
import { Badge } from "../kit/badge";
import { DataTable, type Column } from "../kit/data-table";
import { Select } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { EmptyState, LoadError, NoAccess, Notice } from "../kit/notice";
import { AdminPage, Panel, Toolbar } from "../kit/page";

const PERIODS = [7, 30, 90, 365];

function QueryTable({ title, hint, rows }: { title: string; hint?: string; rows: QueryStat[] }) {
  const t = useTranslations("adminAi.analytics");
  const columns: Column<QueryStat>[] = [
    { key: "query", header: t("columns.query"), primary: true, cell: (row) => <span className="break-words font-medium">{row.query}</span> },
    { key: "count", header: t("columns.count"), className: "md:w-28", cell: (row) => <span className="tabular-nums">{row.count}</span> },
    { key: "avg", header: t("columns.avg"), className: "md:w-44", cell: (row) => <span className="tabular-nums">{row.avg_results}</span> },
  ];
  return (
    <section className="space-y-2">
      <h2 className="text-lg">{title}</h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <DataTable caption={title} columns={columns} rows={rows} rowKey={(row) => row.query} empty={<EmptyState title={t("empty")} />} />
    </section>
  );
}

/** Запросы по дням: полоса показывает долю от самого загруженного дня, числа подписаны текстом. */
function PerDay({ days }: { days: AnalyticsReport["per_day"] }) {
  const t = useTranslations("adminAi.analytics");
  const locale = useLocale();
  const max = Math.max(1, ...days.map((day) => day.searches));
  if (days.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {days.map((day) => (
        <li key={day.day} className="grid grid-cols-[9rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr]">
          <span className="text-muted-foreground">{formatIsoDate(day.day, locale)}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-3 rounded-sm bg-primary" style={{ width: `${(day.searches / max) * 70}%`, minWidth: 2 }} aria-hidden />
            <span className="whitespace-nowrap tabular-nums">{t("perDayValue", { count: day.searches, zero: day.zero_result })}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Аналитика поиска для роли «Аналитик»: только агрегаты без персональных данных. */
export function AnalyticsView() {
  const t = useTranslations("adminAi.analytics");
  const locale = useLocale();
  const me = useMe();
  const allowed = can(me, "analytics.view");
  const [days, setDays] = useState(30);
  const report = useLoad(() => (allowed ? analyticsApi.report(days) : Promise.resolve(null)), [days], "ai");
  const ai = useAction("ai");
  const [summary, setSummary] = useState<AiSummary | null>(null);
  if (!allowed) return <NoAccess />;

  const data = report.data;
  const stale: Column<AnalyticsReport["stale_pages"][number]>[] = [
    { key: "page", header: t("columns.page"), primary: true, cell: (row) => <span className="break-words font-medium">{row.title}</span> },
    { key: "type", header: t("columns.type"), cell: (row) => (t.has(`types.${row.object_type}`) ? t(`types.${row.object_type}`) : row.object_type) },
    { key: "updated", header: t("columns.updated"), cell: (row) => <span className="text-muted-foreground">{formatIsoDate(row.updated_at, locale)}</span> },
  ];

  return (
    <AdminPage title={t("title")} lead={t("intro")}>
      <Toolbar>
        <label className="block text-sm sm:w-48">
          <span className="mb-1.5 block font-medium">{t("period")}</span>
          <Select value={days} onChange={(event) => { setDays(Number(event.target.value)); setSummary(null); }}>
            {PERIODS.map((n) => <option key={n} value={n}>{t("days", { n })}</option>)}
          </Select>
        </label>
      </Toolbar>
      {report.error && <LoadError message={report.error} onRetry={report.reload} />}
      {report.loading && !data && <Notice kind="loading">{t("loading")}</Notice>}

      {data && (
        <div className="space-y-6" aria-busy={report.loading}>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [t("cards.searches"), data.total_searches.toLocaleString("ru-RU")],
              [t("cards.zero"), data.zero_result_searches.toLocaleString("ru-RU")],
              [t("cards.rate"), `${Math.round(data.zero_result_rate * 100)}%`],
              [t("cards.rare"), data.rare_queries.toLocaleString("ru-RU")],
            ].map(([label, value]) => (
              <div key={label} className="card flex flex-col-reverse justify-end gap-1 p-5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums text-primary">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title={t("perDay")} description={t("perDayHint")}>
              <PerDay days={data.per_day} />
            </Panel>
            <Panel title={t("recommendations")}>
              {data.recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRecommendations")}</p>
              ) : (
                <ul className="-my-2 divide-y text-sm">
                  {data.recommendations.map((rec, index) => <li key={`${rec.code}-${index}`} className="py-2">{t(`rec.${rec.code}`, rec.params)}</li>)}
                </ul>
              )}
              <div className="space-y-3 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ai.pending}
                  onClick={() => void ai.run(async () => setSummary(await analyticsApi.aiSummary(days, (["kk", "ru", "en"].includes(locale) ? locale : "ru") as AiLang)))}
                >
                  <Sparkles aria-hidden />
                  {t("ai.run")}
                </Button>
                <div aria-live="polite" className="space-y-2">
                  {ai.pending && <Notice kind="loading">{t("ai.running")}</Notice>}
                  {ai.error && <Notice kind="error">{ai.error}</Notice>}
                  {summary && !summary.available && <Notice kind="warning">{t("ai.off")}</Notice>}
                  {summary?.available && (
                    <div className="space-y-2 text-sm">
                      <h3 className="text-base font-bold">{t("ai.title")}</h3>
                      <Badge tone="warning">{summary.label}</Badge>
                      <p className="whitespace-pre-line">{summary.text}</p>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          <QueryTable title={t("topQueries")} rows={data.top_queries} />
          <QueryTable title={t("zeroQueries")} hint={t("zeroQueriesHint")} rows={data.zero_queries} />
          <QueryTable title={t("aiQuestions")} rows={data.ai_questions} />

          <section className="space-y-2">
            <h2 className="text-lg">{t("staleTitle")}</h2>
            <DataTable caption={t("staleTitle")} columns={stale} rows={data.stale_pages} rowKey={(row) => row.id} empty={<EmptyState title={t("noStale")} />} />
          </section>
          <p className="text-sm text-muted-foreground">{t("views")}</p>
        </div>
      )}
    </AdminPage>
  );
}
