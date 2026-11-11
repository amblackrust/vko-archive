"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Вкладки-ссылки раздела в виде «таблеток»; на узком экране лента прокручивается, активная вкладка остаётся в поле зрения. */
export function TabsNav({ label, items, active }: {
  label: string;
  items: { id: string; href: string; label: string; count?: number | null }[];
  active: string;
}) {
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full bg-surface p-1 shadow-card">
        {items.map((item) => {
          const isCurrent = item.id === active;
          return (
            <li key={item.id}>
              <Link
                ref={isCurrent ? current : undefined}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium",
                  isCurrent ? "bg-primary text-primary-foreground" : "hover:bg-primary-soft hover:text-primary",
                )}
              >
                {item.label}
                {item.count != null && <span className={cn("text-sm tabular-nums", isCurrent ? "opacity-80" : "text-muted-foreground")}>{item.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
