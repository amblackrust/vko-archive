"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Notice } from "../notice";
import { useLoad } from "../use-load";
import { SettingForm } from "./setting-form";
import { settingsApi, type SettingKey } from "./settings-api";

const GROUPS: SettingKey[] = ["social", "widgets", "survey", "counter", "useful_links"];

/** Загружает настройки и показывает по форме на группу. */
export function SiteSettingsPanel() {
  const tc = useTranslations("admin.common");
  const t = useTranslations("adminContent.settings");
  const settings = useLoad(() => settingsApi.get(), []);
  if (settings.error) {
    return (
      <Notice kind="error" action={<Button size="sm" variant="outline" onClick={settings.reload}>{tc("retry")}</Button>}>
        {settings.error}
      </Notice>
    );
  }
  if (!settings.data) return <Skeleton className="h-48 w-full" aria-label={tc("loading")} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {GROUPS.map((name) => (
        <SettingForm key={name} name={name} value={settings.data![name]} />
      ))}
    </div>
  );
}
