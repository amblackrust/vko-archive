"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { A11Y_STORAGE_KEY } from "./a11y-init";
import { Segmented } from "./segmented";

const OPTIONS = {
  font: ["md", "lg", "xl"],
  contrast: ["normal", "high"],
  spacing: ["normal", "wide"],
  images: ["on", "off"],
} as const;
type Setting = keyof typeof OPTIONS;
type Prefs = { [K in Setting]: (typeof OPTIONS)[K][number] };

const DEFAULTS: Prefs = { font: "md", contrast: "normal", spacing: "normal", images: "on" };

/** Версия для слабовидящих: настройки хранятся в localStorage и применяются атрибутами на <html> (см. globals.css). */
export function A11ySettings() {
  const t = useTranslations("layout.a11y");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      setPrefs({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) ?? "{}") });
    } catch {
      // Повреждённое значение: остаются настройки по умолчанию.
    }
  }, []);

  function update(next: Prefs) {
    setPrefs(next);
    for (const key of Object.keys(OPTIONS) as Setting[]) {
      if (next[key] === DEFAULTS[key]) document.documentElement.removeAttribute(`data-${key}`);
      else document.documentElement.setAttribute(`data-${key}`, next[key]);
    }
    try {
      localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Приватный режим: настройки действуют до закрытия вкладки.
    }
  }

  const changed = (Object.keys(OPTIONS) as Setting[]).some((key) => prefs[key] !== DEFAULTS[key]);
  return (
    <div className="space-y-4">
      {(Object.keys(OPTIONS) as Setting[]).map((key) => (
        <Segmented
          key={key}
          label={t(`${key}.label`)}
          options={OPTIONS[key].map((value) => ({ value, label: t(`${key}.${value}`) }))}
          value={prefs[key]}
          onChange={(value) => update({ ...prefs, [key]: value })}
        />
      ))}
      {changed && (
        <button type="button" onClick={() => update(DEFAULTS)} className="text-link text-sm font-medium">{t("reset")}</button>
      )}
    </div>
  );
}
