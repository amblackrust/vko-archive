"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "../data-table";
import { Select } from "../form-field";
import { Notice } from "../notice";
import type { HierarchyLevel, ImportReport, ImportRow, RowAction } from "./import-api";
import { useImportError } from "./use-import-error";

const ACTIONS: RowAction[] = ["create", "update", "unchanged", "skip", "error"];
/** Больше строк не рисуем: полный список ошибок — в протоколе CSV. */
const MAX_VISIBLE_ROWS = 300;

const actionStyle: Record<RowAction, string> = {
  create: "bg-accent-soft text-accent-soft-foreground",
  update: "bg-accent-soft text-accent-soft-foreground",
  unchanged: "bg-surface-muted text-muted-foreground",
  skip: "bg-surface-muted text-foreground",
  error: "border border-destructive/40 text-destructive",
};

interface ImportReportViewProps {
  report: ImportReport;
  mapping: Record<string, string>;
  /** Нет — сопоставление только для чтения (после импорта). */
  onMap?: (index: number, field: string) => void;
}

export function ImportReportView({ report, mapping, onMap }: ImportReportViewProps) {
  const t = useTranslations("adminImport.import");
  const { code } = useImportError();
  const id = useId();
  const [onlyProblems, setOnlyProblems] = useState(false);
  const fieldLabel = (field: string) => (t.has(`fields.${field}`) ? t(`fields.${field}`) : field);
  const levelLabel = (level: HierarchyLevel) => t(`levels.${level}`);
  const rows = report.rows.filter((row) => !onlyProblems || row.action === "error" || row.action === "skip");

  const columns: Column<ImportRow>[] = [
    { key: "line", header: t("columns.line"), cell: (row) => row.line, className: "w-16" },
    { key: "code", header: t("columns.code"), cell: (row) => row.archive_code || "—" },
    {
      key: "title",
      header: t("columns.title"),
      cell: (row) => row.values.title_ru || row.values.title_kk || row.values.title_en || "—",
    },
    {
      key: "action",
      header: t("columns.action"),
      cell: (row) => (
        <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", actionStyle[row.action])}>
          {t(`actions.${row.action}`)}
        </span>
      ),
    },
    {
      key: "creates",
      header: t(report.applied ? "columns.created" : "columns.creates"),
      cell: (row) => (row.creates.length ? row.creates.map(levelLabel).join(", ") : "—"),
    },
    {
      key: "errors",
      header: t("columns.errors"),
      cell: (row) =>
        row.errors.length ? (
          <ul className="space-y-0.5 text-xs">
            {row.errors.map((error, index) => (
              <li key={index}>
                {error.field && <span className="font-medium">{fieldLabel(error.field)}: </span>}
                {code(error.code)}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {report.applied && <Notice kind="success">{t("resultApplied")}</Notice>}
      <div className="space-y-2">
        <h3 className="font-medium">{t("mapping")}</h3>
        <p className="text-sm text-muted-foreground">{t("mappingHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.headers.map((header, index) => (
            <div key={index} className="space-y-1">
              <label htmlFor={`${id}-col-${index}`} className="block truncate text-xs text-muted-foreground" title={header}>
                {t("column")}: <span className="font-medium text-foreground">{header || `#${index + 1}`}</span>
              </label>
              <Select
                id={`${id}-col-${index}`}
                value={mapping[String(index)] ?? ""}
                disabled={!onMap}
                onChange={(e) => onMap?.(index, e.target.value)}
              >
                <option value="">{t("ignore")}</option>
                {report.fields.map((field) => (
                  <option key={field} value={field}>{fieldLabel(field)}</option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">{report.applied ? t("resultApplied") : t("result")}</h3>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label={t("result")}>
          {ACTIONS.map((action) => (
            <li key={action} className={cn("rounded px-2 py-1", actionStyle[action])}>
              {t(report.applied ? `actionsDone.${action}` : `actions.${action}`)}: {report.counts[action]}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          {t(report.applied ? "hierarchyApplied" : "hierarchyPreview", {
            fund: report.hierarchy.fund,
            inventory: report.hierarchy.inventory,
            case: report.hierarchy.case,
          })}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          {t("onlyProblems")}
        </label>
      </div>
      <DataTable
        caption={t("result")}
        columns={columns}
        rows={rows.slice(0, MAX_VISIBLE_ROWS)}
        rowKey={(row) => String(row.line)}
        loading={false}
      />
    </div>
  );
}
