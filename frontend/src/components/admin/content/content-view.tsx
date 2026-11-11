"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { NoAccess, Notice } from "../kit/notice";
import { AdminPage, TabPanel, Tabs, useTabParam } from "../kit/page";
import { ResourceList } from "../objects/resource-list";

const KINDS = ["news", "page", "faq", "legal_act", "price_list_item", "memorial_date"] as const;

/** Контент сайта: новости, страницы, вопросы и ответы, нормативные акты, прейскурант, календарь памятных дат. */
export function ContentView() {
  const t = useTranslations("adminContent");
  const me = useMe();
  const panelId = useId();
  const [kind, setKind] = useTabParam(KINDS);
  if (!can(me, "content.view")) return <NoAccess />;
  return (
    <AdminPage title={t("content.title")} lead={t("content.lead")}>
      <Tabs label={t("content.title")} panelId={panelId} active={kind} onChange={setKind} tabs={KINDS.map((id) => ({ id, label: t(`tabs.${id}`) }))} />
      <TabPanel id={panelId} active={kind} className="space-y-3">
        {kind === "price_list_item" && <Notice kind="info">{t("priceNote")}</Notice>}
        <ResourceList key={kind} kind={kind} caption={t(`tabs.${kind}`)} numberHeader={t(`columns.number.${kind}`)} emptyText={t(`emptyHint.${kind}`)} />
      </TabPanel>
    </AdminPage>
  );
}
