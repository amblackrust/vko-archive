"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { I18nValue } from "@/lib/api/admin-content";
import { FormField } from "../form-field";
import { I18nField } from "../i18n-field";
import { Notice } from "../notice";
import { useApiError } from "../use-api-error";
import { settingsApi, type SettingKey, type SiteSettings } from "./settings-api";

interface SettingFormProps<K extends SettingKey> {
  name: K;
  value: SiteSettings[K];
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Одна группа настроек сайта: своя форма, свой запрос, свой статус сохранения. Только для сотрудников с settings.edit. */
export function SettingForm<K extends SettingKey>({ name, value }: SettingFormProps<K>) {
  const t = useTranslations("adminContent.settings");
  const tc = useTranslations("admin.common");
  const describe = useApiError();
  const id = useId();
  const [draft, setDraft] = useState<SiteSettings[K]>(value);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  // Типы групп разные; внутри ветки по `name` значение приводится к своей форме.
  const v = draft as never as Record<string, never>;
  const set = (patch: Record<string, unknown>) => {
    setDraft({ ...draft, ...patch } as SiteSettings[K]);
    setState(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setState(null);
    try {
      setDraft(await settingsApi.put(name, draft));
      setState({ kind: "success", text: t("saved") });
    } catch (caught) {
      setState({ kind: "error", text: describe(caught) });
    } finally {
      setPending(false);
    }
  }

  let fields: React.ReactNode = null;
  if (name === "social") {
    fields = (["instagram", "facebook", "telegram", "youtube", "whatsapp"] as const).map((network) => (
      <FormField key={network} label={t(`social.${network}`)} htmlFor={`${id}-${network}`}>
        <Input id={`${id}-${network}`} type="url" placeholder="https://" value={(v[network] as unknown as { url: string | null }).url ?? ""} onChange={(e) => set({ [network]: { ...(v[network] as object), url: e.target.value || null } })} />
      </FormField>
    ));
  } else if (name === "widgets") {
    fields = (["calendar_weather", "rating", "statistics"] as const).map((widget) => (
      <Check key={widget} label={t(`widgets.${widget}`)} checked={Boolean(v[widget])} onChange={(checked) => set({ [widget]: checked })} />
    ));
  } else if (name === "survey") {
    fields = (
      <>
        <Check label={t("survey.enabled")} checked={Boolean(v.enabled)} onChange={(checked) => set({ enabled: checked })} />
        <I18nField label={t("survey.question")} value={(v.question as I18nValue) ?? {}} onChange={(question) => set({ question })} />
        <FormField label={t("survey.url")} htmlFor={`${id}-url`} hint={t("survey.hint")}>
          <Input id={`${id}-url`} type="url" placeholder="https://" value={(v.url as string | null) ?? ""} onChange={(e) => set({ url: e.target.value || null })} />
        </FormField>
      </>
    );
  } else if (name === "counter") {
    fields = (
      <>
        <Check label={t("counter.enabled")} checked={Boolean(v.enabled)} onChange={(checked) => set({ enabled: checked })} />
        <FormField label={t("counter.base")} htmlFor={`${id}-base`} hint={t("counter.hint")}>
          <Input id={`${id}-base`} type="number" min={0} value={String(v.base_value ?? 0)} onChange={(e) => set({ base_value: Number(e.target.value) || 0 })} />
        </FormField>
      </>
    );
  } else {
    const items = (v.items as unknown as SiteSettings["useful_links"]["items"]) ?? [];
    const setItems = (next: typeof items) => set({ items: next });
    fields = (
      <>
        {items.map((item, index) => (
          <div key={index} className="space-y-2 rounded-md border p-3">
            <I18nField label={t("links.title", { n: index + 1 })} value={item.title} onChange={(title) => setItems(items.map((row, i) => (i === index ? { ...row, title } : row)))} />
            <div className="flex gap-2">
              <Input type="url" required aria-label={t("links.url", { n: index + 1 })} placeholder="https://" value={item.url} onChange={(e) => setItems(items.map((row, i) => (i === index ? { ...row, url: e.target.value } : row)))} />
              <Button type="button" size="icon" variant="ghost" aria-label={t("links.remove", { n: index + 1 })} onClick={() => setItems(items.filter((_, i) => i !== index))}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { title: {}, url: "" }])}>
          <Plus aria-hidden />
          {t("links.add")}
        </Button>
      </>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-surface p-4">
      <h2 className="text-lg font-semibold">{t(`groups.${name as string}`)}</h2>
      <p className="text-sm text-muted-foreground">{t(`descriptions.${name as string}`)}</p>
      <div className="space-y-4">{fields}</div>
      {state && <Notice kind={state.kind}>{state.text}</Notice>}
      <Button type="submit" disabled={pending}>
        {pending ? tc("saving") : tc("save")}
      </Button>
    </form>
  );
}
