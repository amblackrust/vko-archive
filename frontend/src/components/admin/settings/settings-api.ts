import { adminRequest } from "@/lib/api/admin";
import type { I18nValue } from "@/lib/api/admin-content";

/** Контракты /api/admin/settings и /api/admin/synonyms (backend/app/schemas/admin_cms.py). */
export interface SiteSettings {
  social: Record<"instagram" | "facebook" | "telegram" | "youtube" | "whatsapp", { url: string | null; handle: string | null }>;
  widgets: { calendar_weather: boolean; rating: boolean; statistics: boolean };
  survey: { enabled: boolean; question: I18nValue; url: string | null };
  counter: { enabled: boolean; base_value: number };
  useful_links: { items: { title: I18nValue; url: string }[] };
}
export type SettingKey = keyof SiteSettings;

export interface Synonym {
  id: string;
  terms: string[];
  note: string | null;
  is_active: boolean;
}

export const settingsApi = {
  get: () => adminRequest<SiteSettings>("/settings"),
  put: <K extends SettingKey>(key: K, value: SiteSettings[K]) =>
    adminRequest<SiteSettings[K]>(`/settings/${key}`, { method: "PUT", body: { value } }),
  synonyms: () => adminRequest<Synonym[]>("/synonyms"),
  createSynonym: (body: { terms: string[]; note?: string | null }) => adminRequest<Synonym>("/synonyms", { method: "POST", body }),
  updateSynonym: (id: string, body: Partial<Omit<Synonym, "id">>) => adminRequest<Synonym>(`/synonyms/${id}`, { method: "PATCH", body }),
  removeSynonym: (id: string) => adminRequest<void>(`/synonyms/${id}`, { method: "DELETE" }),
};
