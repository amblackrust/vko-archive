import type { useTranslations } from "next-intl";

/** Подпись темы: известные ключи переводятся, незнакомые показываются как есть (тема из админки). */
export function themeLabel(t: ReturnType<typeof useTranslations>, theme: string): string {
  return t.has(`themes.${theme}`) ? t(`themes.${theme}`) : theme;
}
