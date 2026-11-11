"use client";

import { useTranslations } from "next-intl";
import { ForbiddenState } from "@/components/ui/state-view";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { CmsList } from "./cms-list";
import { TabbedPage } from "./tabbed-page";

const KINDS = ["news", "page", "faq", "legal_act", "price_list_item", "memorial_date"] as const;

/** Новости, страницы, FAQ, НПА, прейскурант, календарь памятных дат (T6.10). */
export function ContentView() {
  const t = useTranslations("adminContent");
  const me = useMe();
  if (!can(me, "content.view")) return <ForbiddenState />;
  return (
    <TabbedPage
      title={t("content.title")}
      tabs={KINDS.map((kind) => ({
        key: kind,
        label: t(`tabs.${kind}`),
        content: (
          <div className="space-y-3">
            {kind === "price_list_item" && <p className="text-sm text-muted-foreground">{t("priceNote")}</p>}
            <CmsList kind={kind} />
          </div>
        ),
      }))}
    />
  );
}
