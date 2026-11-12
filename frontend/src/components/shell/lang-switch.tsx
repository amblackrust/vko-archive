"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Segmented control. The thumb slides only when a language is clicked: its place is a pure function of the
 * chosen language, so page navigation (same language) never moves it. */
export function LangSwitch() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams().toString();
  // The clicked language shows at once; the real locale catches up when the new page is ready.
  const [chosen, setChosen] = useState(locale);
  useEffect(() => setChosen(locale), [locale]);
  const index = Math.max(0, routing.locales.indexOf(chosen as (typeof routing.locales)[number]));

  return (
    <div role="group" aria-label={t("language")} className="relative mx-1 flex items-center rounded-full bg-mount-2 p-0.5 text-sm">
      <span
        aria-hidden
        className="absolute left-0.5 top-0.5 h-8 w-11 rounded-full bg-paper shadow-lift transition-transform duration-300 ease-(--ease-spring)"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={code === locale}
          onClick={() => {
            setChosen(code);
            router.replace(`${pathname}${search ? `?${search}` : ""}`, { locale: code });
          }}
          className={clsx("relative h-8 w-11 rounded-full font-medium uppercase transition-colors", code === chosen ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
