import { API_URL } from "@/lib/api/client";
import type { MemorialDate } from "@/lib/api/home";

/** Сбой одного запроса не должен ронять страницу: вместо исключения — null. */
export async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/** month = null, когда запрошен весь год. */
export interface MemorialCalendar {
  year: number;
  month: number | null;
  items: MemorialDate[];
}

/** Календарь памятных дат за год (и месяц). При сбое API — null. */
export async function fetchMemorialCalendar(lang: string, year: number, month?: number | null): Promise<MemorialCalendar | null> {
  const params = new URLSearchParams({ lang, year: String(year) });
  if (month) params.set("month", String(month));
  return safe(
    fetch(`${API_URL}/api/home/memorial-dates?${params}`, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`memorial dates: ${response.status}`);
      return response.json() as Promise<MemorialCalendar>;
    }),
  );
}

/** Число записей открытого списка API (документы, фонды, выставки); недоступный список — null. */
export const fetchTotal = (path: string) =>
  safe(
    fetch(`${API_URL}/api/${path}`, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json().then((data: { total: number }) => data.total);
    }),
  );
