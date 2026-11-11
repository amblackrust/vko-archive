"use client";

import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/api/admin";
import type { I18nValue } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { DataTable, RowAction, type Column } from "../kit/data-table";
import { AdminDialog, ConfirmDialog } from "../kit/dialog";
import { Checkbox, TextField } from "../kit/form";
import { useAction, useLoad } from "../kit/hooks";
import { EmptyState, LoadError, NoAccess, Notice } from "../kit/notice";
import { AdminPage, Panel, TabPanel, Tabs, Toolbar, useTabParam } from "../kit/page";
import { useToast } from "../kit/toast";
import { I18nField } from "../objects/i18n-field";
import { settingsApi, type SettingKey, type SiteSettings, type Synonym } from "./settings-api";

const TABS = ["site", "synonyms"] as const;
const GROUPS: SettingKey[] = ["social", "widgets", "survey", "counter", "useful_links"];

/** Настройки сайта и синонимы поиска — только для администраторов. */
export function SettingsView() {
  const t = useTranslations("adminContent");
  const me = useMe();
  const panelId = useId();
  const [tab, setTab] = useTabParam(TABS);
  if (!can(me, "settings.edit")) return <NoAccess />;
  return (
    <AdminPage title={t("settings.title")} lead={t(tab === "site" ? "settings.intro" : "synonyms.intro")}>
      <Tabs label={t("settings.title")} panelId={panelId} active={tab} onChange={setTab} tabs={TABS.map((id) => ({ id, label: t(`settings.tabs.${id}`) }))} />
      <TabPanel id={panelId} active={tab}>{tab === "site" ? <SiteSettingsPanel /> : <SynonymsPanel />}</TabPanel>
    </AdminPage>
  );
}

/** Загружает настройки и показывает по форме на группу: у каждой свой запрос и свой результат сохранения. */
function SiteSettingsPanel() {
  const settings = useLoad(() => settingsApi.get(), []);
  if (settings.error) return <LoadError message={settings.error} onRetry={settings.reload} />;
  if (!settings.data) return <Skeleton className="h-48 w-full bg-border" />;
  const data = settings.data;
  return (
    <div className="space-y-5">
      {GROUPS.map((name) => <SettingForm key={name} name={name} value={data[name]} />)}
    </div>
  );
}

function SettingForm<K extends SettingKey>({ name, value }: { name: K; value: SiteSettings[K] }) {
  const t = useTranslations("adminContent.settings");
  const tc = useTranslations("admin.common");
  const action = useAction();
  const [draft, setDraft] = useState<SiteSettings[K]>(value);
  const [dirty, setDirty] = useState(false);
  // Типы групп разные; внутри ветки по `name` значение приводится к своей форме.
  const v = draft as never as Record<string, never>;
  const set = (patch: Record<string, unknown>) => {
    setDraft({ ...draft, ...patch } as SiteSettings[K]);
    setDirty(true);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await action.run(async () => setDraft(await settingsApi.put(name, draft)), t("saved", { group: t(`groups.${name as string}`) }));
    if (saved) setDirty(false);
  }

  let fields: React.ReactNode = null;
  if (name === "social") {
    fields = (
      <div className="grid gap-4 sm:grid-cols-2">
        {(["instagram", "facebook", "telegram", "youtube", "whatsapp"] as const).map((network) => (
          <TextField key={network} label={t(`social.${network}`)} type="url" placeholder="https://" value={(v[network] as unknown as { url: string | null }).url ?? ""} onChange={(event) => set({ [network]: { ...(v[network] as object), url: event.target.value || null } })} />
        ))}
      </div>
    );
  } else if (name === "widgets") {
    fields = <Checkbox label={t("widgets.calendar_weather")} checked={Boolean(v.calendar_weather)} onChange={(event) => set({ calendar_weather: event.target.checked })} />;
  } else if (name === "survey") {
    fields = (
      <>
        <Checkbox label={t("survey.enabled")} checked={Boolean(v.enabled)} onChange={(event) => set({ enabled: event.target.checked })} />
        <I18nField textTranslate label={t("survey.question")} value={(v.question as I18nValue) ?? {}} onChange={(question) => set({ question })} />
        <TextField label={t("survey.url")} hint={t("survey.hint")} type="url" placeholder="https://" value={(v.url as string | null) ?? ""} onChange={(event) => set({ url: event.target.value || null })} />
      </>
    );
  } else if (name === "counter") {
    fields = (
      <>
        <Checkbox label={t("counter.enabled")} checked={Boolean(v.enabled)} onChange={(event) => set({ enabled: event.target.checked })} />
        <TextField label={t("counter.base")} hint={t("counter.hint")} className="sm:w-56" type="number" min={0} value={String(v.base_value ?? 0)} onChange={(event) => set({ base_value: Number(event.target.value) || 0 })} />
      </>
    );
  } else {
    const items = (v.items as unknown as SiteSettings["useful_links"]["items"]) ?? [];
    const setItems = (next: typeof items) => set({ items: next });
    fields = (
      <>
        {items.length > 0 && (
          <ol className="divide-y rounded-md border">
            {items.map((item, index) => (
              <li key={index} className="space-y-3 p-3">
                <I18nField textTranslate label={t("links.title", { n: index + 1 })} value={item.title} onChange={(title) => setItems(items.map((row, i) => (i === index ? { ...row, title } : row)))} />
                <div className="flex gap-2">
                  <Input type="url" required aria-label={t("links.url", { n: index + 1 })} placeholder="https://" value={item.url} onChange={(event) => setItems(items.map((row, i) => (i === index ? { ...row, url: event.target.value } : row)))} />
                  <RowAction danger label={t("links.remove", { n: index + 1 })} onClick={() => setItems(items.filter((_, i) => i !== index))}><Trash2 /></RowAction>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { title: {}, url: "" }])}>
          <Plus aria-hidden />
          {t("links.add")}
        </Button>
      </>
    );
  }

  return (
    <Panel title={t(`groups.${name as string}`)} description={t(`descriptions.${name as string}`)}>
      <form onSubmit={submit} className="space-y-4">
        {fields}
        {action.error && <Notice kind="error">{action.error}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={action.pending || !dirty}>{action.pending ? tc("saving") : tc("save")}</Button>
          {dirty && <p className="text-sm text-muted-foreground" aria-live="polite">{t("unsaved")}</p>}
        </div>
      </form>
    </Panel>
  );
}

const split = (text: string) => text.split(",").map((term) => term.trim()).filter(Boolean);

/** Группы синонимов поиска (Усть-Каменогорск = Өскемен = Ust-Kamenogorsk): термины через запятую. */
function SynonymsPanel() {
  const t = useTranslations("adminContent.synonyms");
  const tc = useTranslations("admin.common");
  const toast = useToast();
  const list = useLoad(() => settingsApi.synonyms(), []);
  const save = useAction();
  const toggle = useAction();
  const [editing, setEditing] = useState<{ id: string | null; terms: string; note: string } | null>(null);
  const [removing, setRemoving] = useState<Synonym | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const terms = split(editing.terms);
    if (terms.length < 2) return save.setError(t("minTerms"));
    const body = { terms, note: editing.note.trim() || null };
    const saved = await save.run(() => (editing.id ? settingsApi.updateSynonym(editing.id, body) : settingsApi.createSynonym(body)), t("saved"));
    if (saved) {
      setEditing(null);
      list.reload();
    }
  }

  const columns: Column<Synonym>[] = [
    { key: "terms", header: t("terms"), primary: true, cell: (row) => <span className="break-words font-medium">{row.terms.join(" = ")}</span> },
    { key: "note", header: t("note"), cell: (row) => row.note ?? "—" },
    {
      key: "active",
      header: t("active"),
      cell: (row) => (
        <Checkbox
          label={row.is_active ? t("on") : t("off")}
          aria-label={`${row.is_active ? t("on") : t("off")}. ${t("toggle", { name: row.terms[0] })}`}
          checked={row.is_active}
          disabled={toggle.pending}
          onChange={() => void toggle.run(() => settingsApi.updateSynonym(row.id, { is_active: !row.is_active })).then(list.reload)}
        />
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      actions: true,
      className: "md:w-px md:whitespace-nowrap",
      cell: (row) => (
        <div className="flex gap-0.5 max-md:-ml-2 md:justify-end">
          <RowAction label={t("edit", { name: row.terms[0] })} onClick={() => { save.setError(null); setEditing({ id: row.id, terms: row.terms.join(", "), note: row.note ?? "" }); }}><Pencil /></RowAction>
          <RowAction danger label={t("delete", { name: row.terms[0] })} onClick={() => setRemoving(row)}><Trash2 /></RowAction>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <Toolbar
        actions={
          <Button onClick={() => { save.setError(null); setEditing({ id: null, terms: "", note: "" }); }}>
            <Plus aria-hidden />
            {t("create")}
          </Button>
        }
      />
      {toggle.error && <Notice kind="error">{toggle.error}</Notice>}
      <DataTable caption={t("title")} columns={columns} rows={list.data} rowKey={(row) => row.id} loading={list.loading} error={list.error} onRetry={list.reload} empty={<EmptyState title={t("empty")}>{t("emptyHint")}</EmptyState>} />
      {editing && (
        <AdminDialog
          title={t(editing.id ? "editTitle" : "create")}
          description={t("termsHint")}
          busy={save.pending}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="outline" disabled={save.pending} onClick={() => setEditing(null)}>{tc("cancel")}</Button>
              <Button type="submit" form="admin-synonym-form" disabled={save.pending}>{save.pending ? tc("saving") : tc("save")}</Button>
            </>
          }
        >
          <form id="admin-synonym-form" onSubmit={submit} className="space-y-4">
            {save.error && <Notice kind="error">{save.error}</Notice>}
            <TextField label={t("termsField")} required value={editing.terms} onChange={(event) => setEditing({ ...editing, terms: event.target.value })} />
            <TextField label={t("note")} maxLength={255} value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} />
          </form>
        </AdminDialog>
      )}
      {removing && (
        <ConfirmDialog
          danger
          title={t("deleteTitle")}
          description={t("deleteDescription", { name: removing.terms.join(" = ") })}
          confirmLabel={t("deleteConfirm")}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await settingsApi.removeSynonym(removing.id);
            toast.success(t("deleted"));
            list.reload();
          }}
        />
      )}
    </div>
  );
}
