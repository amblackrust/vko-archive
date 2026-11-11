"use client";

import { useId, useState } from "react";
import { CircleX, Download, FileCheck2, Minus, Pencil, Plus, SkipForward, Upload, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can, pickName, type BranchOption } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import { useMe } from "../admin-provider";
import { Badge, WORKFLOW_STATUSES, type Tone } from "../kit/badge";
import { DataTable, type Column } from "../kit/data-table";
import { ConfirmDialog } from "../kit/dialog";
import { Checkbox, FormField, SelectField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { NoAccess, Notice } from "../kit/notice";
import { AdminPage, Panel, TabPanel, Tabs, useTabParam } from "../kit/page";
import { useApiError } from "../kit/use-api-error";
import { importApi, reportCsv, saveBlob, type ExportFilters, type ImportReport, type ImportRow, type RowAction } from "./import-api";

// Совпадают с лимитами сервера (services/import_export.py); сервер проверяет сам.
const MAX_MB = 5;
const MAX_ROWS = 5000;
/** Больше строк не рисуем: полный список ошибок — в протоколе CSV. */
const MAX_VISIBLE_ROWS = 300;
const TABS = ["import", "export"] as const;
const STEPS = ["file", "check", "apply"] as const;
const ACTIONS: Record<RowAction, { tone: Tone; icon: LucideIcon }> = {
  create: { tone: "success", icon: Plus },
  update: { tone: "info", icon: Pencil },
  unchanged: { tone: "neutral", icon: Minus },
  skip: { tone: "warning", icon: SkipForward },
  error: { tone: "danger", icon: CircleX },
};

interface PanelProps {
  branches: BranchOption[];
  branchScoped: boolean;
}

/** Импорт и экспорт каталога. Видимость вкладок — косметика: права проверяет сервер. */
export function ImportExportView() {
  const t = useTranslations("adminImport");
  const me = useMe();
  const panelId = useId();
  const allowed = TABS.filter((tab) => can(me, `catalog.${tab}`));
  const [tab, setTab] = useTabParam(TABS);
  const branches = useLoad(() => (allowed.length ? importApi.branches() : Promise.resolve([])), [allowed.length], "import");
  if (!allowed.length) return <NoAccess />;
  const active = allowed.includes(tab) ? tab : allowed[0];
  const props = { branches: branches.data ?? [], branchScoped: me.branch_scoped };
  return (
    <AdminPage title={t("title")} lead={t("lead")}>
      {allowed.length > 1 && <Tabs label={t("title")} panelId={panelId} active={active} onChange={setTab} tabs={allowed.map((id) => ({ id, label: t(`tabs.${id}`) }))} />}
      <TabPanel id={panelId} active={active} className="space-y-5">
        {branches.error && <Notice kind="error">{branches.error}</Notice>}
        {active === "import" ? <ImportPanel {...props} /> : <ExportPanel {...props} />}
      </TabPanel>
    </AdminPage>
  );
}

/** Импорт в три шага: файл и параметры, проверка без записи с сопоставлением колонок, импорт и протокол. */
function ImportPanel({ branches, branchScoped }: PanelProps) {
  const t = useTranslations("adminImport.import");
  const locale = useLocale();
  const me = useMe();
  const describe = useApiError("import");
  const action = useAction("import");
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState("");
  const [atomic, setAtomic] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notApplied, setNotApplied] = useState(false);

  const options = () => ({ mapping: mapping ?? undefined, branchId: branchId || undefined, atomic });

  async function run(mode: "check" | "apply") {
    if (!file) return;
    setBusy(mode);
    await action.run(async () => {
      const result = await (mode === "check" ? importApi.preview : importApi.apply)(file, me.csrf_token, options());
      setReport(result);
      if (mode === "check") setMapping(result.mapping);
      setNotApplied(mode === "apply" && !result.applied);
    });
    setBusy(null);
  }

  function reset(next: File | null) {
    setFile(next);
    setReport(null);
    setNotApplied(false);
    setMapping(null);
    action.setError(null);
  }

  function mapColumn(index: number, field: string) {
    // Одно поле — одна колонка: выбранное поле снимается с других колонок.
    const next = Object.fromEntries(Object.entries(mapping ?? {}).filter(([key, value]) => key !== String(index) && value !== field));
    if (field) next[String(index)] = field;
    setMapping(next);
  }

  const applied = report?.applied === true;
  const mappingChanged = report !== null && JSON.stringify(mapping) !== JSON.stringify(report.mapping);
  const canApply = report !== null && !applied && !mappingChanged && report.counts.create + report.counts.update > 0;
  const step = applied ? 2 : report ? 1 : 0;

  return (
    <>
      <ol aria-label={t("stepsLabel")} className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((name, index) => (
          <li key={name} aria-current={step === index ? "step" : undefined} className={cn("border-t-2 pt-2 text-sm", index <= step ? "border-primary" : "border-border-strong text-muted-foreground")}>
            <span className="font-semibold tabular-nums">{index + 1}. </span>
            <span className={cn(step === index && "font-semibold")}>{t(`steps.${name}`)}</span>
          </li>
        ))}
      </ol>

      <Panel title={t("steps.file")} description={t("intro")}>
        <Notice kind="info">{t("draftNotice")}</Notice>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t("file")} hint={t("fileHint", { mb: MAX_MB, rows: MAX_ROWS })}>
            {(field) => (
              <input
                {...field}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full rounded-md border border-border-strong text-sm file:mr-3 file:h-10 file:border-0 file:border-r file:border-solid file:border-border-strong file:bg-surface-muted file:px-3 file:font-medium"
                onChange={(event) => reset(event.target.files?.[0] ?? null)}
              />
            )}
          </FormField>
          {!branchScoped && (
            <SelectField label={t("branch")} hint={t("branchHint")} value={branchId} onChange={(event) => { setBranchId(event.target.value); setReport(null); }}>
              <option value="">{t("archiveWide")}</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{pickName(branch.name, locale)}</option>)}
            </SelectField>
          )}
        </div>
        <Checkbox label={t("atomic")} hint={t("atomicHint")} checked={atomic} onChange={(event) => setAtomic(event.target.checked)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void run("check")} disabled={!file || busy !== null} variant={report ? "outline" : "primary"}>
            <FileCheck2 aria-hidden />
            {mappingChanged ? t("recheck") : t("preview")}
          </Button>
          {!file && <p className="self-center text-sm text-muted-foreground">{t("chooseFile")}</p>}
        </div>
        <div aria-live="polite" className="space-y-2">
          {busy && <Notice kind="loading">{t(busy === "check" ? "checking" : "applying")}</Notice>}
          {action.error && <Notice kind="error">{action.error}</Notice>}
          {notApplied && <Notice kind="error">{t("notApplied")}</Notice>}
        </div>
      </Panel>

      {report && (
        <>
          <Panel title={t("mapping")} description={t("mappingHint")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {report.headers.map((header, index) => (
                <SelectField key={index} label={`${t("column")}: ${header || `#${index + 1}`}`} value={(mapping ?? report.mapping)[String(index)] ?? ""} disabled={applied} onChange={(event) => mapColumn(index, event.target.value)}>
                  <option value="">{t("ignore")}</option>
                  {report.fields.map((field) => <option key={field} value={field}>{t.has(`fields.${field}`) ? t(`fields.${field}`) : field}</option>)}
                </SelectField>
              ))}
            </div>
            {mappingChanged && <Notice kind="warning">{t("mappingChanged")}</Notice>}
          </Panel>

          <ImportResult
            report={report}
            actions={
              <>
                {(report.counts.error > 0 || report.counts.skip > 0) && (
                  <Button variant="outline" onClick={() => saveBlob(reportCsv(report, t.raw("reportHeader") as string[], describe.code), "import-report.csv")}>
                    <Download aria-hidden />
                    {t("downloadReport")}
                  </Button>
                )}
                {!applied && (
                  <Button onClick={() => setConfirming(true)} disabled={!canApply || busy !== null}>
                    <Upload aria-hidden />
                    {t("apply")}
                  </Button>
                )}
              </>
            }
          />
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title={t("confirmTitle")}
          description={t(atomic ? "confirmTextAtomic" : "confirmText", { create: report?.counts.create ?? 0, update: report?.counts.update ?? 0 })}
          confirmLabel={t("apply")}
          onClose={() => setConfirming(false)}
          onConfirm={() => run("apply")}
        />
      )}
    </>
  );
}

/** Итог проверки или импорта: счётчики по действиям и строки файла с ошибками. */
function ImportResult({ report, actions }: { report: ImportReport; actions: React.ReactNode }) {
  const t = useTranslations("adminImport.import");
  const describe = useApiError("import");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const fieldLabel = (field: string) => (t.has(`fields.${field}`) ? t(`fields.${field}`) : field);
  const rows = report.rows.filter((row) => !onlyProblems || row.action === "error" || row.action === "skip");
  const labels = report.applied ? "actionsDone" : "actions";

  const columns: Column<ImportRow>[] = [
    { key: "line", header: t("columns.line"), className: "md:w-16", cell: (row) => <span className="tabular-nums">{row.line}</span> },
    { key: "code", header: t("columns.code"), cell: (row) => <span className="cipher font-medium">{row.archive_code || "—"}</span> },
    { key: "title", header: t("columns.title"), primary: true, cell: (row) => row.values.title_ru || row.values.title_kk || row.values.title_en || "—" },
    { key: "action", header: t("columns.action"), cell: (row) => <Badge tone={ACTIONS[row.action].tone}>{t(`${labels}.${row.action}`)}</Badge> },
    { key: "creates", header: t(report.applied ? "columns.created" : "columns.creates"), cell: (row) => (row.creates.length ? row.creates.map((level) => t(`levels.${level}`)).join(", ") : "—") },
    {
      key: "errors",
      header: t("columns.errors"),
      cell: (row) =>
        row.errors.length ? (
          <ul className="space-y-0.5">
            {row.errors.map((error, index) => (
              <li key={index}>
                {error.field && <span className="font-medium">{fieldLabel(error.field)}: </span>}
                {describe.code(error.code)}
              </li>
            ))}
          </ul>
        ) : "—",
    },
  ];

  return (
    <Panel title={t(report.applied ? "resultApplied" : "result")} actions={actions}>
      {report.applied && <Notice kind="success">{t("appliedNotice")}</Notice>}
      <ul className="flex flex-wrap gap-2" aria-label={t("result")}>
        {(Object.keys(ACTIONS) as RowAction[]).map((name) => (
          <li key={name}>
            <Badge tone={report.counts[name] ? ACTIONS[name].tone : "neutral"} className="text-sm">
              {t(`${labels}.${name}`)}: <span className="tabular-nums">{report.counts[name]}</span>
            </Badge>
          </li>
        ))}
      </ul>
      <p className="text-sm">{t(report.applied ? "hierarchyApplied" : "hierarchyPreview", report.hierarchy)}</p>
      <Checkbox label={t("onlyProblems")} checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} />
      {rows.length > MAX_VISIBLE_ROWS && <Notice kind="info">{t("truncated", { shown: MAX_VISIBLE_ROWS, total: rows.length })}</Notice>}
      <DataTable caption={t("result")} columns={columns} rows={rows.slice(0, MAX_VISIBLE_ROWS)} rowKey={(row) => String(row.line)} empty={<p className="px-4 py-6 text-sm text-muted-foreground">{t("noProblems")}</p>} />
    </Panel>
  );
}

/** Экспорт каталога в CSV или XLSX. Сервер отдаёт только разрешённое роли и филиалу. */
function ExportPanel({ branches, branchScoped }: PanelProps) {
  const t = useTranslations("adminImport.export");
  const statuses = useTranslations("admin.workflow.status");
  const locale = useLocale();
  const action = useAction("import");
  const [format, setFormat] = useState<ExportFilters["format"]>("xlsx");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");

  const download = () =>
    action.run(async () => saveBlob(await importApi.exportDocuments({ format, branchId: branchId || undefined, workflowStatus: status || undefined }), `documents.${format}`), t("done"));

  return (
    <Panel title={t("title")} description={t("intro")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label={t("format")} value={format} onChange={(event) => setFormat(event.target.value as ExportFilters["format"])}>
          <option value="xlsx">XLSX</option>
          <option value="csv">CSV</option>
        </SelectField>
        {!branchScoped && (
          <SelectField label={t("branch")} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">{t("allBranches")}</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{pickName(branch.name, locale)}</option>)}
          </SelectField>
        )}
        <SelectField label={t("status")} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {WORKFLOW_STATUSES.map((value) => <option key={value} value={value}>{statuses(value)}</option>)}
        </SelectField>
      </div>
      <Button onClick={() => void download()} disabled={action.pending}>
        <Download aria-hidden />
        {t("download")}
      </Button>
      <div aria-live="polite">
        {action.pending && <Notice kind="loading">{t("downloading")}</Notice>}
        {action.error && <Notice kind="error">{action.error}</Notice>}
      </div>
    </Panel>
  );
}
