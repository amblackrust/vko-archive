"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { DataTable, type Column } from "../data-table";
import { Select } from "../form-field";
import { Pagination } from "../pagination";
import { useLoad } from "../use-load";
import { TranslationDialog } from "./translation-dialog";
import { TranslationStatusBadge } from "./translation-status-badge";
import { TRANSLATION_LANGS, TRANSLATION_OBJECT_TYPES, translationsApi, type TranslationItem } from "./translations-api";

const PAGE_SIZE = 20;
const CATALOG_TYPES = new Set(["document", "fund", "inventory", "case"]);

/** Модуль прав для просмотра типа (как WORKFLOW_OBJECTS на сервере) — только для косметики фильтра. */
function moduleOf(type: string) {
  if (CATALOG_TYPES.has(type)) return "catalog";
  return type === "branch" ? "branches" : "content";
}

/** Раздел «Переводы» (T6.11): статусы kk/ru/en по материалам, черновой перевод ИИ, проверка. */
export function TranslationsView() {
  const t = useTranslations("adminImport.translations");
  const tw = useTranslations("adminImport.workflow");
  const me = useMe();
  const types = TRANSLATION_OBJECT_TYPES.filter((type) => can(me, `${moduleOf(type)}.view`));
  const [objectType, setObjectType] = useState<string>(types[0] ?? "document");
  const [lang, setLang] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoad(
    () =>
      types.length
        ? translationsApi.list({
            object_type: objectType,
            lang: lang && status ? lang : undefined,
            status: lang && status ? status : undefined,
            q: q || undefined,
            page,
            page_size: PAGE_SIZE,
          })
        : Promise.resolve(null),
    [objectType, lang, status, q, page],
  );
  if (!types.length) return <ForbiddenState />;

  const columns: Column<TranslationItem>[] = [
    { key: "label", header: t("columns.label"), cell: (row) => <span className="font-medium">{row.label}</span> },
    { key: "workflow", header: t("columns.workflow"), cell: (row) => (tw.has(row.workflow_status) ? tw(row.workflow_status) : row.workflow_status) },
    {
      key: "languages",
      header: t("columns.languages"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {TRANSLATION_LANGS.map((code) => (
            <TranslationStatusBadge key={code} lang={code} status={row.translation_status[code]} />
          ))}
        </div>
      ),
    },
    {
      key: "open",
      header: "",
      className: "w-12",
      cell: (row) => (
        <Button size="icon" variant="ghost" aria-label={t("open", { label: row.label })} onClick={() => setOpenId(row.id)}>
          <Languages />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="flex flex-wrap gap-3">
        <Select className="w-auto" aria-label={t("objectType")} value={objectType} onChange={(e) => { setObjectType(e.target.value); setPage(1); }}>
          {types.map((type) => (
            <option key={type} value={type}>{t(`types.${type}`)}</option>
          ))}
        </Select>
        <Select className="w-auto" aria-label={t("lang")} value={lang} onChange={(e) => { setLang(e.target.value); setPage(1); }}>
          <option value="">{t("anyLang")}</option>
          {TRANSLATION_LANGS.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
        </Select>
        <Select className="w-auto" aria-label={t("status")} value={status} disabled={!lang} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t("anyStatus")}</option>
          {(["missing", "machine", "verified"] as const).map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}
        </Select>
        <Input className="max-w-xs" type="search" aria-label={t("search")} placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={list.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
      />
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />}
      <TranslationDialog objectType={objectType} objectId={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </div>
  );
}
