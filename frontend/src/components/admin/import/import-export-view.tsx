"use client";

import { useTranslations } from "next-intl";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { importApi } from "./import-api";
import { ExportPanel } from "./export-panel";
import { ImportPanel } from "./import-panel";

/** Раздел «Импорт и экспорт» (T6.6). Видимость блоков — косметика: права проверяет сервер. */
export function ImportExportView() {
  const t = useTranslations("adminImport.import");
  const me = useMe();
  const canImport = can(me, "catalog.import");
  const canExport = can(me, "catalog.export");
  const branches = useLoad(() => (canImport || canExport ? importApi.branches() : Promise.resolve([])), [canImport, canExport]);
  if (!canImport && !canExport) return <ForbiddenState />;
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
      {branches.error && <Notice kind="error">{branches.error}</Notice>}
      {canImport && <ImportPanel branches={branches.data ?? []} branchScoped={me.branch_scoped} />}
      {canExport && <ExportPanel branches={branches.data ?? []} branchScoped={me.branch_scoped} />}
    </div>
  );
}
