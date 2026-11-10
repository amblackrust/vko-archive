import { API_URL } from "@/lib/api/client";

export interface MemorialCalendarItem {
  day: number | null;
  month: number;
  event_year: number | null;
  date_text: string | null;
  text: string;
  text_lang: string;
}

/** month = null, когда запрошен весь год. */
export interface MemorialCalendar {
  year: number;
  month: number | null;
  items: MemorialCalendarItem[];
}

/** Календарь памятных дат за год (и месяц). При сбое API — null: страница покажет состояние «недоступно». */
export async function fetchMemorialCalendar(lang: string, year: number, month?: number): Promise<MemorialCalendar | null> {
  const params = new URLSearchParams({ lang, year: String(year) });
  if (month) params.set("month", String(month));
  try {
    const response = await fetch(`${API_URL}/api/home/memorial-dates?${params}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as MemorialCalendar) : null;
  } catch {
    return null;
  }
}
