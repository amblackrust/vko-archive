"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

const examples = ["e1", "e2", "e3", "e4"] as const;

/** Главная строка поиска: обычный GET на /<locale>/search?q=… (работает без JS и без ИИ). */
export function HeroSearch() {
  const t = useTranslations("home.hero");
  const locale = useLocale();
  return (
    <div className="space-y-4">
      <form
        role="search"
        action={`/${locale}/search`}
        method="get"
        className="flex h-14 items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white"
      >
        <label htmlFor="hero-q" className="sr-only">{t("label")}</label>
        <Search className="size-5 shrink-0 text-[#5a6478]" aria-hidden />
        <input
          id="hero-q"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={500}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 bg-transparent text-base text-[#121a2b] placeholder:text-[#5a6478] focus-visible:outline-none"
        />
        <button type="submit" className="h-full shrink-0 rounded-xl bg-[#3247d3] px-4 text-base font-semibold text-white hover:bg-[#2536b0] sm:px-7">
          {t("submit")}
        </button>
      </form>
      <ul className="flex flex-wrap gap-2 text-sm" aria-label={t("chipsLabel")}>
        {examples.map((id) => (
          <li key={id}>
            <Link href={{ pathname: "/search", query: { q: t(id) } }} className="inline-flex min-h-9 items-center rounded-full bg-white/15 px-3.5 hover:bg-white/25">
              {t(id)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
