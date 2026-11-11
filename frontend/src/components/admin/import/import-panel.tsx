"use client";

import { useId, useState } from "react";
import { Download, FileCheck2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pickName, type BranchOption } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { ConfirmDialog } from "../confirm-dialog";
import { FormField, Select } from "../form-field";
import { Notice } from "../notice";
import { importApi, reportCsv, saveBlob, type ImportReport } from "./import-api";
import { ImportReportView } from "./import-report";
import { useImportError } from "./use-import-error";

// Совпадают с лимитами сервера (services/import_export.py); сервер проверяет сам.
const MAX_MB = 5;
const MAX_ROWS = 5000;

interface ImportPanelProps {
  branches: BranchOption[];
  branchScoped: boolean;
}

/** Импорт: файл → проверка (без записи) → сопоставление колонок → импорт → протокол. */
export function ImportPanel({ branches, branchScoped }: ImportPanelProps) {
  const t = useTranslations("adminImport.import");
  const locale = useLocale();
  const me = useMe();
  const { code, describe } = useImportError();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState("");
  const [atomic, setAtomic] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notApplied, setNotApplied] = useState(false);

  const options = () => ({ mapping: mapping ?? undefined, branchId: branchId || undefined, atomic });

  async function check() {
    if (!file) return;
    setBusy("check");
    setError(null);
    try {
      const result = await importApi.preview(file, me.csrf_token, options());
      setReport(result);
      setMapping(result.mapping);
      setNotApplied(false);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(null);
    }
  }

  // Ошибку показываем в панели (свои коды импорта), окно подтверждения при этом закрывается.
  async function apply() {
    if (!file) return;
    setBusy("apply");
    setError(null);
    try {
      const result = await importApi.apply(file, me.csrf_token, options());
      setReport(result);
      setNotApplied(!result.applied);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(null);
    }
  }

  function chooseFile(next: File | null) {
    setFile(next);
    setReport(null);
    setNotApplied(false);
    setMapping(null);
    setError(null);
  }

  function mapColumn(index: number, field: string) {
    // Одно поле — одна колонка: выбранное поле снимается с других колонок.
    const next = Object.fromEntries(Object.entries(mapping ?? {}).filter(([key, value]) => key !== String(index) && value !== field));
    if (field) next[String(index)] = field;
    setMapping(next);
  }

  const mappingChanged = report && JSON.stringify(mapping) !== JSON.stringify(report.mapping);
  const isApplied = report?.applied === true;
  const canApply = report && !isApplied && !mappingChanged && report.counts.create + report.counts.update > 0;

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border bg-surface p-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold">{t("section")}</h2>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <Notice kind="info">{t("draftNotice")}</Notice>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label={t("file")} htmlFor={`${id}-file`} hint={t("fileHint", { mb: MAX_MB, rows: MAX_ROWS })}>
          <input
            id={`${id}-file`}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-describedby={`${id}-file-msg`}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-surface-muted file:px-3 file:py-1.5"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
        </FormField>
        {!branchScoped && (
          <FormField label={t("branch")} htmlFor={`${id}-branch`} hint={t("branchHint")}>
            <Select id={`${id}-branch`} aria-describedby={`${id}-branch-msg`} value={branchId} onChange={(e) => { setBranchId(e.target.value); setReport(null); }}>
              <option value="">{t("archiveWide")}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{pickName(branch.name, locale)}</option>
              ))}
            </Select>
          </FormField>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={atomic} onChange={(e) => setAtomic(e.target.checked)} />
        <span>
          <span className="font-medium">{t("atomic")}</span>
          <span className="block text-muted-foreground">{t("atomicHint")}</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={check} disabled={!file || busy !== null} variant={report ? "outline" : "primary"}>
          <FileCheck2 aria-hidden />
          {mappingChanged ? t("recheck") : t("preview")}
        </Button>
        {report && !isApplied && (
          <Button onClick={() => setConfirming(true)} disabled={!canApply || busy !== null}>
            <Upload aria-hidden />
            {t("apply")}
          </Button>
        )}
        {report && (report.counts.error > 0 || report.counts.skip > 0) && (
          <Button
            variant="outline"
            onClick={() => saveBlob(reportCsv(report, t.raw("reportHeader") as string[], code), "import-report.csv")}
          >
            <Download aria-hidden />
            {t("downloadReport")}
          </Button>
        )}
      </div>
      {busy && <Notice kind="loading">{t(busy === "check" ? "checking" : "applying")}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {notApplied && <Notice kind="error">{t("notApplied")}</Notice>}
      {report && (
        <ImportReportView report={report} mapping={mapping ?? report.mapping} onMap={isApplied ? undefined : mapColumn} />
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirmTitle")}
        description={t(atomic ? "confirmTextAtomic" : "confirmText", {
          create: report?.counts.create ?? 0,
          update: report?.counts.update ?? 0,
        })}
        confirmLabel={t("apply")}
        onConfirm={apply}
      />
    </section>
  );
}
