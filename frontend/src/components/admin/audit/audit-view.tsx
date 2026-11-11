"use client";

import { useState } from "react";
import { Ban, CircleCheck, CircleX, Download, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/api/admin";
import { formatDateTime } from "@/lib/dates";
import { useMe } from "../admin-provider";
import { useActionLabel } from "../kit/action-label";
import { Badge, type Tone } from "../kit/badge";
import { DataTable, type Column } from "../kit/data-table";
import { SelectField, TextField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { EmptyState, NoAccess, Notice } from "../kit/notice";
import { AdminPage, Panel } from "../kit/page";
import { saveBlob } from "../import/import-api";
import { auditApi, type AuditFilters, type AuditRecord } from "./audit-api";

const PAGE_SIZE = 50;
const RESULTS: Record<string, { tone: Tone; icon: LucideIcon }> = {
  success: { tone: "success", icon: CircleCheck },
  failure: { tone: "danger", icon: CircleX },
  denied: { tone: "warning", icon: Ban },
};

/** Журнал действий: кто, что и когда сделал, с каким результатом. Пароли и секреты в журнал не попадают (сервер вырезает). */
export function AuditView() {
  const t = useTranslations("adminContent.audit");
  const actionLabel = useActionLabel();
  const me = useMe();
  const allowed = can(me, "audit.view");
  const exporting = useAction();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const list = useLoad(() => (allowed ? auditApi.list(filters, page, PAGE_SIZE) : Promise.resolve(null)), [filters, page]);
  if (!allowed) return <NoAccess />;

  const set = (name: keyof AuditFilters, value: string) => setDraft({ ...draft, [name]: value });
  const apply = (next: AuditFilters) => {
    setDraft(next);
    setFilters(next);
    setPage(1);
  };

  const columns: Column<AuditRecord>[] = [
    { key: "ts", header: t("columns.ts"), className: "md:whitespace-nowrap", cell: (row) => <time dateTime={row.ts} className="tabular-nums">{formatDateTime(row.ts)}</time> },
    { key: "actor", header: t("columns.user"), cell: (row) => <span className="break-all">{row.actor ?? t("system")}</span> },
    { key: "action", header: t("columns.action"), primary: true, cell: (row) => <span className="font-semibold" title={row.action_type}>{actionLabel(row.action_type)}</span> },
    {
      key: "object",
      header: t("columns.object"),
      cell: (row) =>
        row.object_type ? (
          <>
            {row.object_type}
            {row.object_id && <span className="block break-all font-mono text-xs text-muted-foreground">{row.object_id}</span>}
          </>
        ) : "—",
    },
    {
      key: "result",
      header: t("columns.result"),
      cell: (row) => (row.result in RESULTS ? <Badge tone={RESULTS[row.result].tone}>{t(`results.${row.result}`)}</Badge> : row.result),
    },
  ];

  return (
    <AdminPage
      title={t("title")}
      lead={t("lead")}
      actions={
        can(me, "audit.export") && (
          <Button variant="outline" disabled={exporting.pending} onClick={() => void exporting.run(async () => saveBlob(await auditApi.exportCsv(filters), "audit-log.csv"), t("exported"))}>
            <Download aria-hidden />
            {exporting.pending ? t("exporting") : t("export")}
          </Button>
        )
      }
    >
      {exporting.error && <Notice kind="error">{exporting.error}</Notice>}
      <Panel title={t("filters.title")}>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <TextField label={t("filters.q")} value={draft.q ?? ""} onChange={(event) => set("q", event.target.value)} />
          <TextField label={t("filters.action")} placeholder="news.update" value={draft.action_type ?? ""} onChange={(event) => set("action_type", event.target.value)} />
          <TextField label={t("filters.object")} placeholder="document" value={draft.object_type ?? ""} onChange={(event) => set("object_type", event.target.value)} />
          <SelectField label={t("filters.result")} value={draft.result ?? ""} onChange={(event) => set("result", event.target.value)}>
            <option value="">{t("filters.anyResult")}</option>
            {Object.keys(RESULTS).map((result) => <option key={result} value={result}>{t(`results.${result}`)}</option>)}
          </SelectField>
          <TextField label={t("filters.from")} type="datetime-local" value={draft.date_from ?? ""} onChange={(event) => set("date_from", event.target.value)} />
          <TextField label={t("filters.to")} type="datetime-local" value={draft.date_to ?? ""} onChange={(event) => set("date_to", event.target.value)} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit">{t("apply")}</Button>
            <Button type="button" variant="outline" onClick={() => apply({})}>{t("reset")}</Button>
          </div>
        </form>
      </Panel>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={list.data?.items ?? null}
        rowKey={(row) => String(row.id)}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty={<EmptyState title={t("empty")}>{t("emptyHint")}</EmptyState>}
        pagination={list.data ? { page, pageSize: PAGE_SIZE, total: list.data.total, onPage: setPage } : undefined}
      />
    </AdminPage>
  );
}
