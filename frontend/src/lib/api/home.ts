import { API_URL } from "./client";

export interface MemorialDate {
  day: number | null;
  month: number;
  event_year: number | null;
  date_text: string | null;
  text: string;
  text_lang: string;
  is_today: boolean;
}

export interface MemorialDates {
  year: number;
  month: number;
  items: MemorialDate[];
}

/** Главная не должна падать из-за одного блока: при сбое API возвращаем null. */
export async function fetchMemorialDates(lang: string): Promise<MemorialDates | null> {
  try {
    const response = await fetch(`${API_URL}/api/home/memorial-dates?lang=${lang}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as MemorialDates) : null;
  } catch {
    return null;
  }
}
