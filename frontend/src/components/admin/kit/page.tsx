"use client";

import { useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Экран раздела: заголовок, пояснение, главные действия справа и содержимое. */
export function AdminPage({ title, lead, actions, children }: {
  title: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl space-y-1.5">
          <h1 className="text-2xl sm:text-[1.75rem]">{title}</h1>
          {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** Белая панель с заголовком: блок формы, сводка, шаг мастера. */
export function Panel({ title, description, actions, className, children, flush, level: Heading = "h2" }: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  /** Содержимое без полей: списки и таблицы от края до края панели. */
  flush?: boolean;
  level?: "h2" | "h3";
}) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-4 py-3.5 sm:px-6">
          <div className="min-w-0 space-y-0.5">
            {title && <Heading className="text-[1.0625rem] font-bold">{title}</Heading>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? undefined : "space-y-4 p-4 sm:p-6"}>{children}</div>
    </section>
  );
}

/** Строка над таблицей: слева поиск и фильтры, справа действия. На телефоне элементы встают друг под другом. */
export function Toolbar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 max-sm:basis-full max-sm:[&>*]:w-full">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Поле поиска со значком; подпись читается экранным диктором и видна как подсказка в поле. */
export function SearchField({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cn("relative block sm:w-80", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" className="pl-10" placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

interface TabsProps<T extends string> {
  label: string;
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  /** id панели, которой управляют вкладки (role="tabpanel"). */
  panelId: string;
}

/** Вкладки внутри раздела в виде «таблеток», как на сайте: стрелки переключают, на узком экране лента прокручивается. */
export function Tabs<T extends string>({ label, tabs, active, onChange, panelId }: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = (tabs.findIndex((tab) => tab.id === active) + step + tabs.length) % tabs.length;
    onChange(tabs[index].id);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
    <div ref={list} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex w-max gap-1 rounded-full bg-surface p-1 shadow-card">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${panelId}-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          aria-controls={panelId}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-10 whitespace-nowrap rounded-full px-4 text-[0.9375rem] font-medium transition-colors",
            tab.id === active ? "bg-primary text-primary-foreground" : "hover:bg-primary-soft hover:text-primary",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
    </div>
  );
}

/** Панель активной вкладки. */
export function TabPanel({ id, active, className, children }: { id: string; active: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={`${id}-${active}`} tabIndex={-1} className={className}>
      {children}
    </div>
  );
}

/** Активная вкладка в адресе (?tab=…): на вкладку можно дать ссылку, она переживает обновление страницы. */
export function useTabParam<T extends string>(ids: readonly T[], param = "tab"): [T, (id: T) => void] {
  const search = useSearchParams();
  const raw = search.get(param);
  const active = ids.includes(raw as T) ? (raw as T) : ids[0];
  const setActive = useCallback(
    (id: T) => {
      const next = new URLSearchParams(window.location.search);
      if (id === ids[0]) next.delete(param);
      else next.set(param, id);
      const query = next.toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [ids, param],
  );
  return [active, setActive];
}
