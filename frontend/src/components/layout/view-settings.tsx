"use client";

import { Eye } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Menu } from "@/components/ui/menu";
import { A11ySettings } from "./a11y-settings";
import { Segmented } from "./segmented";

/** Тема оформления; выбранный вариант показывается после монтирования, чтобы не расходиться с сервером. */
export function ThemeChoice() {
  const t = useTranslations("layout.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Segmented
      label={t("label")}
      options={(["light", "dark"] as const).map((value) => ({ value, label: t(value) }))}
      value={mounted ? ((resolvedTheme as "light" | "dark") ?? "light") : null}
      onChange={setTheme}
    />
  );
}

/** Кнопка «глаз» в шапке: тема оформления и версия для слабовидящих в одном небольшом окне. */
export function ViewSettings() {
  const t = useTranslations("layout.a11y");
  return (
    <Menu label={t("open")} className="size-11 justify-center px-0" panelClassName="w-80 p-4" trigger={<Eye className="size-5" aria-hidden />}>
      <div className="space-y-4">
        <ThemeChoice />
        <A11ySettings />
      </div>
    </Menu>
  );
}
