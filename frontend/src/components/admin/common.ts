import type { Schema } from "@/lib/api/client";

type Lang = "kk" | "ru" | "en";

/** i18n objects come as {kk, ru, en}; show the current language, falling back to any filled one. */
export function pick(value: unknown, lang: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const o = value as Partial<Record<Lang, string>>;
    return o[lang as Lang] || o.ru || o.kk || o.en || "";
  }
  return "";
}

export const STATUS_TONE: Record<string, "neutral" | "warn" | "action" | "ok" | "bad"> = {
  draft: "neutral", review: "warn", needs_changes: "bad", approved: "action", published: "ok", archived: "neutral",
};

export type Item = Schema["ListItem"];
