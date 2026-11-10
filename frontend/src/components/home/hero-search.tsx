"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

const examples = ["e1", "e2", "e3", "e4"] as const;

/** Главная строка поиска: обычный GET на /<locale>/search?q=… (работает без JS и без ИИ). */
export function HeroSearch() {
  const t = useTranslations("home.hero");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % examples.length), 4000);
    return () => clearInterval(timer);
  }, [focused]);

  return (
    <div className="space-y-4">
      <form role="search" action={`/${locale}/search`} method="get" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="hero-q" className="sr-only">{t("label")}</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="hero-q"
            name="q"
            type="search"
            autoComplete="off"
            maxLength={500}
            placeholder={t(examples[index])}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="h-14 w-full rounded-lg border-2 border-primary bg-surface pl-12 pr-4 text-base placeholder:text-muted-foreground focus-visible:outline-offset-2"
          />
        </div>
        <Button type="submit" size="lg" className="h-14 px-8">{t("submit")}</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("chipsLabel")}</span>
        {examples.map((id) => (
          <Link
            key={id}
            href={{ pathname: "/search", query: { q: t(id) } }}
            className="min-h-9 rounded-full border bg-surface px-3 py-1.5 hover:bg-surface-muted"
          >
            {t(id)}
          </Link>
        ))}
      </div>
      <Link href="/catalog" className="inline-block text-sm font-medium text-primary hover:underline">
        {t("advanced")}
      </Link>
    </div>
  );
}
