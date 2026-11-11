"use client";

import { useId, useState } from "react";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { DataTable, type Column } from "../data-table";
import { FormField, Select } from "../form-field";
import { saveBlob } from "../import/import-api";
import { Notice } from "../notice";
import { Pagination } from "../pagination";
import { useApiError } from "../use-api-error";
import { useLoad } from "../use-load";
import { auditApi, type AuditFilters, type AuditRecord } from "./audit-api";

const PAGE_SIZE = 50;
const RESULTS = ["success", "failure", "denied"];

function AuditContent() {
  const t = useTranslations("adminContent.audit");
  const locale = useLocale();
  const me = useMe();
  const describe = useApiError();
  const id = useId();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [exportState, setExportState] = useState<{ kind: "loading" | "error" | "success"; text: string } | null>(null);
  const list = useLoad(() => auditApi.list(filters, page, PAGE_SIZE), [filters, page]);

  const set = (name: keyof AuditFilters, value: string) => setDraft({ ...draft, [name]: value });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" });

  async function download() {
    setExportState({ kind: "loading", text: t("exporting") });
    try {
      saveBlob(await auditApi.exportCsv(filters), "audit-log.csv");
      setExportState({ kind: "success", text: t("exported") });
    } catch (caught) {
      setExportState({ kind: "error", text: describe(caught) });
    }
  }

  const columns: Column<AuditRecord>[] = [
    { key: "ts", header: t("columns.ts"), className: "whitespace-nowrap", cell: (row) => date.format(new Date(row.ts)) },
    { key: "actor", header: t("columns.user"), cell: (row) => row.actor ?? "—" },
    { key: "action", header: t("columns.action"), cell: (row) => <code className="text-xs">{row.action_type}</code> },
    { key: "object", header: t("columns.object"), cell: (row) => row.object_type ?? "—" },
    { key: "object_id", header: t("columns.objectId"), cell: (row) => <span className="break-all text-xs">{row.object_id ?? "—"}</span> },
    { key: "result", header: t("columns.result"), cell: (row) => (RESULTS.includes(row.result) ? t(`results.${row.result}`) : row.result) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
        {can(me, "audit.export") && (
          <Button variant="outline" onClick={download} disabled={exportState?.kind === "loading"}>
            <Download aria-hidden />
            {t("export")}
          </Button>
        )}
      </div>
      {exportState && <Notice kind={exportState.kind}>{exportState.text}</Notice>}
      <form
        className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(draft);
          setPage(1);
        }}
      >
        <FormField label={t("filters.q")} htmlFor={`${id}-q`}>
          <Input id={`${id}-q`} value={draft.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </FormField>
        <FormField label={t("filters.action")} htmlFor={`${id}-action`}>
          <Input id={`${id}-action`} placeholder="news.update" value={draft.action_type ?? ""} onChange={(e) => set("action_type", e.target.value)} />
        </FormField>
        <FormField label={t("filters.object")} htmlFor={`${id}-object`}>
          <Input id={`${id}-object`} placeholder="document" value={draft.object_type ?? ""} onChange={(e) => set("object_type", e.target.value)} />
        </FormField>
        <FormField label={t("filters.result")} htmlFor={`${id}-result`}>
          <Select id={`${id}-result`} value={draft.result ?? ""} onChange={(e) => set("result", e.target.value)}>
            <option value="">—</option>
            {RESULTS.map((result) => <option key={result} value={result}>{t(`results.${result}`)}</option>)}
          </Select>
        </FormField>
        <FormField label={t("filters.from")} htmlFor={`${id}-from`}>
          <Input id={`${id}-from`} type="datetime-local" value={draft.date_from ?? ""} onChange={(e) => set("date_from", e.target.value)} />
        </FormField>
        <FormField label={t("filters.to")} htmlFor={`${id}-to`}>
          <Input id={`${id}-to`} type="datetime-local" value={draft.date_to ?? ""} onChange={(e) => set("date_to", e.target.value)} />
        </FormField>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit">{t("apply")}</Button>
          <Button type="button" variant="outline" onClick={() => { setDraft({}); setFilters({}); setPage(1); }}>{t("reset")}</Button>
        </div>
      </form>
      <DataTable caption={t("title")} columns={columns} rows={list.data?.items ?? null} rowKey={(row) => String(row.id)} loading={list.loading} error={list.error} onRetry={list.reload} emptyText={t("empty")} />
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />}
    </div>
  );
}

/** Журнал действий (T6.13): фильтры, постраничный список, CSV-экспорт. Пароли и секреты в журнал не попадают (сервер вырезает). */
export function AuditView() {
  const me = useMe();
  return can(me, "audit.view") ? <AuditContent /> : <ForbiddenState />;
}
