import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["kk", "ru", "en"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];

/** Подписи переключателя языка (по ТЗ: KZ/RU/EN) и значение атрибута lang. */
export const localeLabels: Record<Locale, { short: string; name: string }> = {
  kk: { short: "KZ", name: "Қазақша" },
  ru: { short: "RU", name: "Русский" },
  en: { short: "EN", name: "English" },
};
