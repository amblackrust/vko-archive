"use client";

import { useId, useState } from "react";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pickName, type BranchOption } from "@/lib/api/admin";
import { FormField, Select } from "../form-field";
import { Notice } from "../notice";
import { importApi, saveBlob, type ExportFilters } from "./import-api";
import { useImportError } from "./use-import-error";

const STATUSES = ["draft", "review", "needs_changes", "approved", "published", "archived"] as const;

interface ExportPanelProps {
  branches: BranchOption[];
  branchScoped: boolean;
}

/** Экспорт каталога в CSV/XLSX. Сервер отдаёт только разрешённое роли и филиалу. */
export function ExportPanel({ branches, branchScoped }: ExportPanelProps) {
  const t = useTranslations("adminImport.export");
  const tw = useTranslations("adminImport.workflow");
  const locale = useLocale();
  const { describe } = useImportError();
  const id = useId();
  const [format, setFormat] = useState<ExportFilters["format"]>("xlsx");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState<{ kind: "loading" | "success" | "error"; text: string } | null>(null);

  async function download() {
    setState({ kind: "loading", text: t("downloading") });
    try {
      const blob = await importApi.exportDocuments({ format, branchId: branchId || undefined, workflowStatus: status || undefined });
      saveBlob(blob, `documents.${format}`);
      setState({ kind: "success", text: t("done") });
    } catch (caught) {
      setState({ kind: "error", text: describe(caught) });
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border bg-surface p-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={t("format")} htmlFor={`${id}-format`}>
          <Select id={`${id}-format`} value={format} onChange={(e) => setFormat(e.target.value as ExportFilters["format"])}>
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </Select>
        </FormField>
        {!branchScoped && (
          <FormField label={t("branch")} htmlFor={`${id}-branch`}>
            <Select id={`${id}-branch`} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t("allBranches")}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{pickName(branch.name, locale)}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label={t("status")} htmlFor={`${id}-status`}>
          <Select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{tw(value)}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <Button onClick={download} disabled={state?.kind === "loading"}>
        <Download aria-hidden />
        {t("download")}
      </Button>
      {state && <Notice kind={state.kind}>{state.text}</Notice>}
    </section>
  );
}
