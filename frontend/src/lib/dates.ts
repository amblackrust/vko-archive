/**
 * Даты без Intl: в части браузеров нет казахских данных ICU, и месяц выводится как «M11»,
 * а сервер и клиент расходятся при гидратации. Названия месяцев заданы явно, результат одинаков везде.
 */
const MONTHS: Record<string, { standalone: string[]; inDate: string[] }> = {
  ru: {
    standalone: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
    inDate: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  },
  kk: {
    standalone: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
    inDate: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
  },
  en: {
    standalone: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    inDate: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
};

const names = (locale: string) => MONTHS[locale] ?? MONTHS.ru;
const pad = (n: number) => String(n).padStart(2, "0");

/** Название месяца в именительном падеже; month — от 1 до 12. */
export const monthName = (month: number, locale: string) => names(locale).standalone[month - 1];

/** «12 ноября», «12 қараша», «12 November». */
export const formatDayMonth = (day: number, month: number, locale: string) => `${day} ${names(locale).inDate[month - 1]}`;

/** «12 ноября 2026 г.», «2026 жылғы 12 қараша», «12 November 2026». */
export function formatLongDate(day: number, month: number, year: number, locale: string): string {
  const dayMonth = formatDayMonth(day, month, locale);
  if (locale === "kk") return `${year} жылғы ${dayMonth}`;
  return locale === "ru" ? `${dayMonth} ${year} г.` : `${dayMonth} ${year}`;
}

/** Дата из ISO-строки в UTC (в БД — полночь по UTC): сервер и браузер показывают одно число. */
export function formatIsoDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return formatLongDate(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear(), locale);
}

/** Дата и время в местном часовом поясе для админки: «12.11.2026 15:04». */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
