"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/api/admin";
import { localeLabels } from "@/lib/i18n/routing";
import { useMe } from "../admin-provider";
import { WorkflowBadge } from "../kit/badge";
import { DataTable, RowTitle, type Column } from "../kit/data-table";
import { AdminDialog } from "../kit/dialog";
import { Select, SelectField } from "../kit/form";
import { useAction, useDebounced, useLoad } from "../kit/hooks";
import { EmptyState, NoAccess, Notice } from "../kit/notice";
import { AdminPage, SearchField, Toolbar } from "../kit/page";
import { KINDS } from "../objects/specs";
import { MachineTranslateButton } from "./translate-buttons";
import { TranslationBadges } from "./translation-status-badge";
import { TRANSLATION_LANGS, TRANSLATION_OBJECT_TYPES, translationsApi, type TranslationDetail, type TranslationItem, type TranslationLang } from "./translations-api";

const PAGE_SIZE = 20;

/** Переводы: статусы KZ / RU / EN по материалам, черновой перевод ИИ и отметка «проверено». */
export function TranslationsView() {
  const t = useTranslations("adminImport.translations");
  const me = useMe();
  // Виды материалов, которые сотрудник вправе просматривать (косметика фильтра: права проверяет сервер).
  const types = TRANSLATION_OBJECT_TYPES.filter((type) => can(me, `${KINDS[type].module}.view`));
  const [objectType, setObjectType] = useState<string>(types[0] ?? "document");
  const [lang, setLang] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<TranslationItem | null>(null);

  useEffect(() => setPage(1), [objectType, lang, status, q]);
  const filtered = Boolean(lang && status);
  const list = useLoad(
    () =>
      types.length
        ? translationsApi.list({ object_type: objectType, lang: filtered ? lang : undefined, status: filtered ? status : undefined, q: q || undefined, page, page_size: PAGE_SIZE })
        : Promise.resolve(null),
    [objectType, lang, status, q, page],
    "import",
  );
  if (!types.length) return <NoAccess />;

  const columns: Column<TranslationItem>[] = [
    { key: "label", header: t("columns.label"), primary: true, cell: (row) => <RowTitle className="cipher" onClick={() => setOpen(row)}>{row.label}</RowTitle> },
    { key: "workflow", header: t("columns.workflow"), cell: (row) => <WorkflowBadge status={row.workflow_status} /> },
    { key: "languages", header: t("columns.languages"), cell: (row) => <TranslationBadges label={false} status={row.translation_status} /> },
  ];

  return (
    <AdminPage title={t("title")} lead={t("intro")}>
      <Toolbar>
        <Select className="sm:w-52" aria-label={t("objectType")} value={objectType} onChange={(event) => setObjectType(event.target.value)}>
          {types.map((type) => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
        </Select>
        <SearchField label={t("search")} value={search} onChange={setSearch} />
        <Select className="sm:w-40" aria-label={t("lang")} value={lang} onChange={(event) => setLang(event.target.value)}>
          <option value="">{t("anyLang")}</option>
          {TRANSLATION_LANGS.map((code) => <option key={code} value={code}>{localeLabels[code].name}</option>)}
        </Select>
        <Select className="sm:w-44" aria-label={t("status")} value={status} disabled={!lang} title={lang ? undefined : t("statusNeedsLang")} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("anyStatus")}</option>
          {(["missing", "machine", "verified"] as const).map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}
        </Select>
      </Toolbar>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={list.data?.items ?? null}
        rowKey={(row) => row.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty={<EmptyState title={t("emptyList")}>{t("emptyListHint")}</EmptyState>}
        pagination={list.data ? { page, pageSize: PAGE_SIZE, total: list.data.total, onPage: setPage } : undefined}
      />
      {open && <TranslationDialog key={open.id} objectType={objectType} item={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </AdminPage>
  );
}

/** Переводы одного материала: исходный и целевой язык рядом, черновой перевод ИИ, отметка «проверено». */
function TranslationDialog({ objectType, item, onClose, onChanged }: { objectType: string; item: TranslationItem; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("adminImport.translations");
  const tc = useTranslations("admin.common");
  const loaded = useLoad(() => translationsApi.get(objectType, item.id), [objectType, item.id], "import");
  const verify = useAction("import");
  // Свежая копия после перевода или проверки; до этого — загруженная.
  const [fresh, setFresh] = useState<TranslationDetail | null>(null);
  const [source, setSource] = useState<TranslationLang>("ru");
  const [target, setTarget] = useState<TranslationLang>("kk");
  const detail = fresh ?? loaded.data;
  const targetStatus = detail?.translation_status[target];

  function changed(next: TranslationDetail) {
    setFresh(next);
    onChanged();
  }

  return (
    <AdminDialog size="lg" title={t("dialogTitle")} description={<span className="cipher">{item.label}</span>} onClose={onClose} footer={<Button onClick={onClose}>{tc("close")}</Button>}>
      {loaded.error && <Notice kind="error">{loaded.error}</Notice>}
      {!detail && !loaded.error && <Notice kind="loading">{tc("loading")}</Notice>}
      {detail && (
        <>
          <TranslationBadges status={detail.translation_status} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t("source")} value={source} onChange={(event) => setSource(event.target.value as TranslationLang)}>
              {TRANSLATION_LANGS.map((lang) => <option key={lang} value={lang}>{localeLabels[lang].name}</option>)}
            </SelectField>
            <SelectField label={t("target")} value={target} error={source === target ? t("sameLang") : null} onChange={(event) => setTarget(event.target.value as TranslationLang)}>
              {TRANSLATION_LANGS.map((lang) => <option key={lang} value={lang}>{localeLabels[lang].name}</option>)}
            </SelectField>
          </div>
          <dl className="divide-y rounded-md border">
            {Object.entries(detail.fields).map(([field, values]) => (
              <div key={field} className="grid gap-x-4 gap-y-2 p-3 sm:grid-cols-2">
                <dt className="text-sm font-semibold sm:col-span-2">{t.has(`fieldNames.${field}`) ? t(`fieldNames.${field}`) : field}</dt>
                {[source, target].map((lang, index) => (
                  <dd key={`${lang}-${index}`} className="min-w-0 text-sm">
                    <span className="block text-xs text-muted-foreground">{localeLabels[lang].name}</span>
                    <span lang={lang} className="whitespace-pre-wrap break-words">{values[lang] || <span className="text-muted-foreground">{t("empty")}</span>}</span>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
          {detail.can_machine_translate ? (
            <MachineTranslateButton objectType={objectType} objectId={detail.id} version={detail.version} source={source} target={target} targetStatus={targetStatus} onDone={changed} />
          ) : (
            <Notice kind="info">{t("onlyDraft")}</Notice>
          )}
          {targetStatus === "machine" && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm">{t("verifyHint")}</p>
              <Button disabled={verify.pending} onClick={() => void verify.run(async () => changed(await translationsApi.verify(objectType, detail.id, target, detail.version)), t("verifyDone"))}>
                <CircleCheck aria-hidden />
                {t("verify", { lang: localeLabels[target].name })}
              </Button>
              {verify.error && <Notice kind="error">{verify.error}</Notice>}
            </div>
          )}
        </>
      )}
    </AdminDialog>
  );
}
