import { useTranslations } from "next-intl";

/** Подпись темы: известные темы переводятся, неизвестные показываются как есть. */
export function ThemeLabel({ theme }: { theme: string }) {
  const t = useTranslations("exhibitions.themes");
  return <span>{t.has(theme) ? t(theme) : theme}</span>;
}
