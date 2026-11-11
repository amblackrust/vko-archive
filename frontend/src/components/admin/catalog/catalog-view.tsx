"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { can, pickName } from "@/lib/api/admin";
import type { ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { NoAccess } from "../kit/notice";
import { AdminPage, TabPanel, Tabs } from "../kit/page";
import { ResourceList } from "../objects/resource-list";
import { CATALOG_KINDS, type CatalogKind } from "../objects/specs";

const PARENT_FIELD: Partial<Record<CatalogKind, string>> = { inventory: "fund_id", case: "inventory_id", document: "case_id" };
const CHILD_KIND: Partial<Record<CatalogKind, CatalogKind>> = { fund: "inventory", inventory: "case", case: "document" };

interface Parent {
  kind: CatalogKind;
  id: string;
  label: string;
}

/** Каталог: фонд, опись, дело, документ. Вкладка показывает весь уровень, нажатие на название — вложенные записи. */
export function CatalogView() {
  const t = useTranslations("adminCatalog");
  const locale = useLocale();
  const me = useMe();
  const panelId = useId();
  const [kind, setKind] = useState<CatalogKind>("fund");
  // Цепочка выбранных родителей: фонд, опись, дело; список показывает вложенное в последнего.
  const [trail, setTrail] = useState<Parent[]>([]);
  if (!can(me, "catalog.view")) return <NoAccess />;
  const parent = trail.at(-1);
  const child = CHILD_KIND[kind];
  const parentField = PARENT_FIELD[kind];

  function open(row: ListItem) {
    if (!child) return;
    setTrail([...trail, { kind, id: row.id, label: [row.number, pickName(row.title, locale)].filter(Boolean).join(" · ") }]);
    setKind(child);
  }

  return (
    <AdminPage title={t("title")} lead={t("lead")}>
      <Tabs
        label={t("levels")}
        panelId={panelId}
        active={kind}
        tabs={CATALOG_KINDS.map((id) => ({ id, label: t(`kinds.${id}`) }))}
        onChange={(next) => {
          setKind(next);
          setTrail([]);
        }}
      />
      <TabPanel id={panelId} active={kind} className="space-y-3">
        {trail.length > 0 && (
          <nav aria-label={t("breadcrumbs")}>
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              {trail.map((item, index) => (
                <li key={item.id} className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    className="cipher text-left text-link"
                    onClick={() => {
                      setTrail(trail.slice(0, index));
                      setKind(item.kind);
                    }}
                  >
                    {index === 0 ? t(`kinds.${item.kind}`) : trail[index - 1].label}
                  </button>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </li>
              ))}
              <li aria-current="location" className="cipher min-w-0 font-semibold">{parent?.label}</li>
            </ol>
          </nav>
        )}
        <ResourceList
          key={`${kind}-${parent?.id ?? "all"}`}
          kind={kind}
          caption={t(`kinds.${kind}`)}
          numberHeader={t(`columns.number.${kind}`)}
          numberFirst
          parentId={parent?.id}
          createDefaults={parentField && parent ? { [parentField]: parent.id } : undefined}
          createBlocked={kind !== "fund" && !parent ? t(`createInside.${kind}`) : undefined}
          onOpen={child ? open : undefined}
          columns={child ? [{ key: "children", header: t(`kinds.${child}`), cell: (row) => <span className="tabular-nums">{row.children ?? 0}</span> }] : []}
          emptyText={t(`emptyHint.${kind}`)}
        />
      </TabPanel>
    </AdminPage>
  );
}
