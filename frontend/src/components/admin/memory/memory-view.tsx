"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/ui/state-view";
import { can, pickName } from "@/lib/api/admin";
import type { ListItem } from "@/lib/api/admin-content";
import { useMe } from "../admin-provider";
import { CmsList } from "../cms/cms-list";
import { TabbedPage } from "../cms/tabbed-page";
import { LinksDialog } from "./links-dialog";

const KINDS = ["collection", "person", "historical_event"] as const;

/** «Архив памяти»: коллекции (состав), личности, события хронологии (источники, документы) — T6.9. */
export function MemoryView() {
  const t = useTranslations("adminContent");
  const locale = useLocale();
  const me = useMe();
  const [links, setLinks] = useState<{ kind: (typeof KINDS)[number]; id: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  if (!can(me, "content.view")) return <ForbiddenState />;
  return (
    <>
      <TabbedPage
        title={t("memory.title")}
        tabs={KINDS.map((kind) => ({
          key: kind,
          label: t(`tabs.${kind}`),
          content: (
            <CmsList
              kind={kind}
              refreshKey={refresh}
              rowActions={(row: ListItem) =>
                can(me, "content.edit") && (
                  <Button size="icon" variant="ghost" aria-label={t(`links.manage.${kind}`, { name: pickName(row.title, locale) })} onClick={() => setLinks({ kind, id: row.id })}>
                    <Link2 />
                  </Button>
                )
              }
            />
          ),
        }))}
      />
      {links && (
        <LinksDialog
          kind={links.kind}
          id={links.id}
          onClose={() => {
            setLinks(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
