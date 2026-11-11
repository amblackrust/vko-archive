"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { analyticsApi, type AiLang, type AiSummary, type QueryStat } from "@/lib/api/admin-ai";
import { useMe } from "../admin-provider";
import { Select } from "../form-field";
import { Notice } from "../notice";
import { useAiError } from "../ai-tools/use-ai-error";
import { useLoad } from "../use-load";

const PERIODS = [7, 30, 90, 365];

function QueryTable({ title, rows }: { title: string; rows: QueryStat[] }) {
  const t = useTranslations("adminAi.analytics");
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label={title}>
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-muted text-left">
              <tr>
                <th scope="col" className="px-3 py-2">{t("columns.query")}</th>
                <th scope="col" className="px-3 py-2">{t("columns.count")}</th>
                <th scope="col" className="px-3 py-2">{t("columns.avg")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.query} className="border-t">
                  <td className="px-3 py-2 break-words">{row.query}</td>
                  <td className="px-3 py-2">{row.count}</td>
                  <td className="px-3 py-2">{row.avg_results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Раздел «Аналитика» (T4.11, T6.14) для роли «Аналитик»: только агрегаты без персональных данных. */
export function AnalyticsView() {
  const t = useTranslations("adminAi.analytics");
  const locale = useLocale();
  const describe = useAiError();
  const me = useMe();
  const [days, setDays] = useState(30);
  const report = useLoad(() => analyticsApi.report(days), [days]);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  if (!can(me, "analytics.view")) return <ForbiddenState />;

  async function runSummary() {
    setSummarising(true);
    setSummaryError(null);
    try {
      setSummary(await analyticsApi.aiSummary(days, (["kk", "ru", "en"].includes(locale) ? locale : "ru") as AiLang));
    } catch (caught) {
      setSummaryError(describe(caught));
    } finally {
      setSummarising(false);
    }
  }

  const data = report.data;
  const maxPerDay = Math.max(1, ...(data?.per_day.map((day) => day.searches) ?? [1]));
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      <label className="inline-block space-y-1.5 text-sm font-medium">
        {t("period")}
        <Select value={days} onChange={(event) => { setDays(Number(event.target.value)); setSummary(null); }} className="w-40 font-normal">
          {PERIODS.map((n) => <option key={n} value={n}>{t("days", { n })}</option>)}
        </Select>
      </label>
      {report.error && <Notice kind="error" action={<Button size="sm" variant="outline" onClick={report.reload}>↻</Button>}>{report.error}</Notice>}
      {report.loading && !data && <Notice kind="loading">…</Notice>}

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t("cards.searches"), data.total_searches],
              [t("cards.zero"), data.zero_result_searches],
              [t("cards.rate"), `${Math.round(data.zero_result_rate * 100)}%`],
              [t("cards.rare"), data.rare_queries],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t("perDay")}</h2>
            {data.per_day.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="space-y-1">
                {data.per_day.map((day) => (
                  <li key={day.day} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-muted-foreground">{day.day}</span>
                    <span className="h-3 rounded bg-primary" style={{ width: `${(day.searches / maxPerDay) * 100}%`, minWidth: 2 }} aria-hidden />
                    <span>{day.searches}{day.zero_result > 0 && ` (${day.zero_result})`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-lg font-semibold">{t("recommendations")}</h2>
            {data.recommendations.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.recommendations.map((rec, index) => <li key={`${rec.code}-${index}`}>{t(`rec.${rec.code}`, rec.params)}</li>)}
            </ul>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => void runSummary()} disabled={summarising}>
                <Sparkles aria-hidden />
                {t("ai.run")}
              </Button>
            </div>
            {summarising && <Notice kind="loading">{t("ai.running")}</Notice>}
            {summaryError && <Notice kind="error">{summaryError}</Notice>}
            {summary && !summary.available && <Notice kind="info">{t("ai.off")}</Notice>}
            {summary?.available && (
              <div className="space-y-1 text-sm">
                <h3 className="font-medium">{t("ai.title")}</h3>
                <p className="whitespace-pre-line">{summary.text}</p>
                <p className="text-xs text-muted-foreground">{summary.label}</p>
              </div>
            )}
          </section>

          <QueryTable title={t("topQueries")} rows={data.top_queries} />
          <QueryTable title={t("zeroQueries")} rows={data.zero_queries} />
          <QueryTable title={t("aiQuestions")} rows={data.ai_questions} />

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t("staleTitle")}</h2>
            {data.stale_pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label={t("staleTitle")}>
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("staleTitle")}</caption>
                  <thead className="bg-surface-muted text-left">
                    <tr>
                      <th scope="col" className="px-3 py-2">{t("columns.page")}</th>
                      <th scope="col" className="px-3 py-2">{t("columns.type")}</th>
                      <th scope="col" className="px-3 py-2">{t("columns.updated")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stale_pages.map((page) => (
                      <tr key={page.id} className="border-t">
                        <td className="px-3 py-2">{page.title}</td>
                        <td className="px-3 py-2">{t.has(`types.${page.object_type}`) ? t(`types.${page.object_type}`) : page.object_type}</td>
                        <td className="px-3 py-2">{page.updated_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">{t("views")}</p>
        </>
      )}
    </div>
  );
}
