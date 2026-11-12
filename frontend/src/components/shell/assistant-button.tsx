"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

/** Always-visible entry to the assistant: an icon and a word. */
export function AssistantButton() {
  const t = useTranslations("assistant");
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("open-assistant"))} className="inline-flex h-10 items-center gap-2 rounded-full bg-action-soft px-4 font-semibold text-action transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-action hover:text-action-ink active:scale-95">
      <Sparkles size={16} aria-hidden />
      <span className="max-sm:hidden">{t("short")}</span>
    </button>
  );
}
