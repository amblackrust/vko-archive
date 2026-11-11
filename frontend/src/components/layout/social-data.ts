import type { SiteSettings } from "@/lib/api/site-settings";

// Ссылки из info/Контакты.docx: запасные значения, если настройки сайта недоступны.
export const socialUrls = {
  instagram: "https://www.instagram.com/arhiv_vko/",
  facebook: "https://www.facebook.com/vkoarhiv",
} as const;

const defaultSocial: SiteSettings["social"] = {
  instagram: { url: socialUrls.instagram, handle: "@arhiv_vko" },
  facebook: { url: socialUrls.facebook, handle: null },
};

/** Соцсети с адресом: из настроек админки, а без них — официальные страницы архива. */
export function socialEntries(social: SiteSettings["social"] | undefined) {
  return Object.entries(social ?? defaultSocial).filter(([, link]) => link.url) as [string, { url: string; handle: string | null }][];
}
