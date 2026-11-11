"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { fetchSearch, type SearchItem } from "@/lib/api/search";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { searchHref } from "./nav-config";

const SHORTCUTS = [
  { id: "navigator", href: "/navigator" },
  { id: "funds", href: "/catalog/funds" },
  { id: "stateService", href: "/services/state" },
  { id: "branches", href: "/branches" },
  { id: "assistant", href: "/assistant" },
] as const;

const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/**
 * Быстрый поиск из любой точки сайта: кнопка в шапке или Ctrl/⌘+K. Результаты подгружаются по мере ввода
 * (обычный поиск, без ИИ), стрелки выбирают строку, Enter открывает её или страницу со всеми результатами.
 * Без JavaScript кнопка остаётся обычной ссылкой на страницу поиска.
 */
export function QuickSearch() {
  const t = useTranslations("layout");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setItems(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // log=false: подсказки при наборе не попадают в статистику поисковых запросов.
      fetchSearch(new URLSearchParams({ q: text, lang: locale, per_group: "3", log: "false" })).then((data) => {
        if (controller.signal.aborted) return;
        setItems(data ? data.groups.flatMap((group) => group.items) : []);
        setActive(0);
      });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const rows = items ? items.map((item) => ({ key: `${item.type}-${item.id}`, href: item.href, title: item.title, note: t.has(`quick.types.${item.type}`) ? t(`quick.types.${item.type}`) : item.type, text: plain(item.snippet ?? "") }))
    : SHORTCUTS.map((item) => ({ key: item.id, href: item.href, title: t(`nav.items.${item.id}`), note: t("quick.section"), text: "" }));
  const allHref = `${searchHref}?q=${encodeURIComponent(query.trim())}`;

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % Math.max(rows.length, 1);
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[active] && (items || !query.trim())) go(rows[active].href);
      else if (query.trim()) go(allHref);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Link
          href={searchHref}
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          aria-label={t("search.label")}
          className="flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground 2xl:w-56 2xl:border 2xl:bg-surface-muted"
        >
          <Search className="size-5 shrink-0" aria-hidden />
          <span className="hidden flex-1 whitespace-nowrap 2xl:block">{t("search.placeholder")}</span>
          <kbd className="hidden whitespace-nowrap rounded border bg-surface px-1.5 text-xs font-medium 2xl:block">Ctrl K</kbd>
        </Link>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1d2a52]/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-[0_24px_64px_-12px_rgb(11_16_32/0.45)] duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Title className="sr-only">{t("search.label")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("quick.hint")}</Dialog.Description>
          <div className="flex items-center gap-3 border-b px-5">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("quick.placeholder")}
              aria-label={t("search.label")}
              role="combobox"
              aria-expanded
              aria-controls="quick-results"
              aria-activedescendant={rows[active] ? `quick-${rows[active].key}` : undefined}
              autoComplete="off"
              maxLength={200}
              className="h-14 min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          <p className="px-5 pt-3 text-xs font-medium text-muted-foreground" aria-live="polite">
            {items === null ? t("quick.shortcuts") : items.length === 0 ? t("quick.empty") : t("quick.results")}
          </p>
          <ul ref={listRef} id="quick-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {rows.map((row, index) => (
              <li key={row.key} id={`quick-${row.key}`} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onClick={() => go(row.href)}
                  onMouseEnter={() => setActive(index)}
                  className={cn("grid w-full gap-x-4 rounded-lg px-3 py-2.5 text-left sm:grid-cols-[1fr_auto]", index === active && "bg-primary-soft")}
                >
                  <span className="min-w-0">
                    <span className={cn("block truncate font-medium", index === active && "text-primary")}>{row.title}</span>
                    {row.text && <span className="block truncate text-sm text-muted-foreground">{row.text}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground sm:pt-1">{row.note}</span>
                </button>
              </li>
            ))}
          </ul>
          {query.trim().length >= 2 && (
            <button type="button" onClick={() => go(allHref)} className="flex w-full items-center justify-between gap-3 border-t px-5 py-3 text-left text-sm font-medium text-primary hover:bg-primary-soft">
              {t("quick.all", { query: query.trim() })}
              <CornerDownLeft className="size-4" aria-hidden />
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
