import { API_URL } from "./client";

/** Безопасное подмножество настроек сайта из админки (backend/app/schemas/content.py: PublicSettings). */
export interface SiteSettings {
  social: Record<string, { url: string | null; handle: string | null }>;
  widgets: Record<string, boolean>;
  survey: { enabled: boolean; question: string; url: string | null };
  counter: { enabled: boolean; value: number };
  useful_links: { title: string; url: string }[];
}

/** При сбое API — null: компоненты показывают значения по умолчанию, сайт не падает. */
export async function fetchSiteSettings(lang: string): Promise<SiteSettings | null> {
  try {
    const response = await fetch(`${API_URL}/api/site-settings?lang=${encodeURIComponent(lang)}`, {
      next: { revalidate: 60 },
    });
    return response.ok ? ((await response.json()) as SiteSettings) : null;
  } catch {
    return null;
  }
}
