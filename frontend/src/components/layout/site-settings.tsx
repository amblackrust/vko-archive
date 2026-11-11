"use client";

import { createContext, useContext } from "react";
import type { SiteSettings } from "@/lib/api/site-settings";

const SiteSettingsContext = createContext<SiteSettings | null>(null);

/** Настройки сайта из админки для шапки, подвала и мобильного меню. null = API недоступен. */
export function SiteSettingsProvider({ value, children }: { value: SiteSettings | null; children: React.ReactNode }) {
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
