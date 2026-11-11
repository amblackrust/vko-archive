"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface TabbedPageProps {
  title: string;
  tabs: { key: string; label: string; content: React.ReactNode }[];
}

/** Заголовок раздела и переключатель видов (вкладки). Содержимое неактивных вкладок не монтируется. */
export function TabbedPage({ title, tabs }: TabbedPageProps) {
  const t = useTranslations("adminContent");
  const id = useId();
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold">{title}</h1>
      <div role="tablist" aria-label={t("sections")} className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`${id}-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={tab.key === current.key}
            aria-controls={`${id}-panel`}
            onClick={() => setActive(tab.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab.key === current.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${current.key}`}>
        {current.content}
      </div>
    </div>
  );
}
