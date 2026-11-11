import type { useTranslations } from "next-intl";
import { formatDayMonth, formatLongDate } from "@/lib/dates";

type T = ReturnType<typeof useTranslations>;

/** Подпись темы или типа: известные ключи переводятся, заведённые в админке показываются как есть. */
export const themeLabel = (t: T, group: string, value: string): string =>
  t.has(`${group}.${value}`) ? t(`${group}.${value}`) : value;

/** Дата события: «30.08.1720» из API -> «30 августа 1720 г.» (или «30 августа» под заголовком года); иной формат — как есть. */
export function eventDate(event: { date_text: string | null; year: number | null }, locale: string, withYear = true): string | null {
  const parts = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(event.date_text ?? "");
  if (!parts) return event.date_text ?? (event.year != null ? String(event.year) : null);
  const [day, month, year] = parts.slice(1).map(Number);
  return withYear ? formatLongDate(day, month, year, locale) : formatDayMonth(day, month, locale);
}
