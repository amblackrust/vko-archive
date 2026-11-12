"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";

export function HeroSearch({ examples }: { examples: string[] }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (value: string) => {
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}&types=document`);
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="glassine flex h-[4.5rem] items-center gap-2 rounded-full border border-frame-strong/60 pl-6 pr-2.5 shadow-lift transition-[box-shadow,transform,border-color] duration-500 ease-(--ease-spring) focus-within:scale-[1.012] focus-within:border-action focus-within:shadow-lift-high md:h-24 md:pl-9 md:pr-3.5"
      >
        <label htmlFor="hero-q" className="sr-only">
          {t("searchLabel")}
        </label>
        <Search className="shrink-0 text-ink-3" size={26} aria-hidden />
        <input
          id="hero-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 text-xl tracking-[-0.01em] outline-none placeholder:text-ink-3 md:px-4 md:text-[1.7rem]"
        />
        <button
          type="submit"
          aria-label={t("searchButton")}
          title={t("searchButton")}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-action text-action-ink transition-[filter,transform] duration-200 ease-(--ease-spring) hover:brightness-110 active:scale-90 active:duration-75 md:size-[4.5rem]"
        >
          <ArrowRight size={26} aria-hidden />
        </button>
      </form>
      <ul className="mt-6 flex flex-wrap gap-2.5">
        {examples.map((example) => (
          <li key={example}>
            <Link
              href={`/search?q=${encodeURIComponent(example)}&types=document`}
              className="inline-flex h-11 items-center rounded-full bg-mount-2 px-5 font-medium text-ink-2 no-underline transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95"
            >
              {example}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
