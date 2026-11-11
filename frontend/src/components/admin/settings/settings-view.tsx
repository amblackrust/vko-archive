"use client";

import { useTranslations } from "next-intl";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { TabbedPage } from "../cms/tabbed-page";
import { SiteSettingsPanel } from "./site-settings-panel";
import { SynonymsPanel } from "./synonyms-panel";

/** Настройки сайта и синонимы поиска — только для администраторов (settings.edit). */
export function SettingsView() {
  const t = useTranslations("adminContent");
  const me = useMe();
  if (!can(me, "settings.edit")) return <ForbiddenState />;
  return (
    <TabbedPage
      title={t("settings.title")}
      tabs={[
        { key: "site", label: t("settings.tabSite"), content: <SiteSettingsPanel /> },
        { key: "synonyms", label: t("settings.tabSynonyms"), content: <SynonymsPanel /> },
      ]}
    />
  );
}
