"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/lib/i18n/navigation";

const KEY = "vko-recent";
const LIMIT = 6;

interface RecentItem {
  href: string;
  code: string;
  title: string;
}

function read(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Запоминает открытую запись каталога в браузере посетителя (без регистрации и без отправки на сервер). */
export function TrackRecent({ href, code, title }: RecentItem) {
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([{ href, code, title }, ...read().filter((item) => item.href !== href)].slice(0, LIMIT)));
    } catch {
      // Хранилище недоступно (приватное окно) — список просто не ведётся.
    }
  }, [href, code, title]);
  return null;
}

/** «Вы недавно смотрели»: последние открытые фонды и документы — вернуться к ним можно в один щелчок. */
export function RecentStrip() {
  const t = useTranslations("catalog.recent");
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => setItems(read()), []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="catalog-recent" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 id="catalog-recent" className="text-sm font-semibold text-muted-foreground">{t("title")}</h2>
      {/* На телефоне записи идут отдельной строкой под заголовком: рядом с ним названия сжимались до одного шифра. */}
      <ul className="order-last flex w-full min-w-0 flex-wrap gap-2 sm:order-none sm:w-auto sm:flex-1">
        {items.map((item) => (
          <li key={item.href} className="min-w-0">
            <Link href={item.href} title={item.title} className="flex max-w-full items-center sm:max-w-72 gap-2 rounded-full bg-surface px-3.5 py-1.5 text-sm shadow-card transition-colors hover:text-primary">
              <span className="cipher shrink-0 font-semibold text-primary">{item.code}</span>
              <span className="truncate">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.removeItem(KEY);
          } catch {
            // нечего очищать
          }
          setItems([]);
        }}
        className="ml-auto text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground sm:ml-0"
      >
        {t("clear")}
      </button>
    </section>
  );
}
