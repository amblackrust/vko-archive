"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

/** Переключатель «Персональные рекомендации» (состояние — в localStorage, см. personal-history.ts). */
export function PersonalToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  const t = useTranslations("aiDocument.recommendations");
  const hintId = useId();
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        role="switch"
        aria-checked={enabled}
        aria-describedby={hintId}
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
      <span>
        <span className="font-medium">{t("personalToggle")}</span>
        <span id={hintId} className="block text-muted-foreground">{t("personalHint")}</span>
      </span>
    </label>
  );
}
