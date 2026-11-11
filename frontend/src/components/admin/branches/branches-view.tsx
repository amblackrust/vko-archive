"use client";

import { useTranslations } from "next-intl";
import { can } from "@/lib/api/admin";
import { useMe } from "../admin-provider";
import { Badge } from "../kit/badge";
import { NoAccess } from "../kit/notice";
import { AdminPage } from "../kit/page";
import { ResourceList } from "../objects/resource-list";

/** Филиалы: контакты, режим работы, координаты, фото здания. Администратор филиала видит только свой. */
export function BranchesView() {
  const t = useTranslations("adminCatalog");
  const me = useMe();
  if (!can(me, "branches.view")) return <NoAccess />;
  return (
    <AdminPage title={t("branches.title")} lead={t(me.branch_scoped ? "branches.leadScoped" : "branches.lead")}>
      <ResourceList
        kind="branch"
        caption={t("branches.title")}
        numberHeader={t("fields.slug")}
        pageSize={100}
        emptyText={t("branches.empty")}
        columns={[
          {
            key: "map",
            header: t("branches.map"),
            cell: (row) => (row.extra.show_on_map ? <Badge tone="success">{t("branches.onMap")}</Badge> : <Badge>{t("branches.offMap")}</Badge>),
          },
        ]}
      />
    </AdminPage>
  );
}
