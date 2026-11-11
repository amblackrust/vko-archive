"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Кнопка темы (админка). Значок переключают классы dark:, а не состояние React: нет рассинхрона при гидратации. */
export function ThemeToggle() {
  const t = useTranslations("layout.theme");
  const { setTheme } = useTheme();
  return (
    <>
      <Button variant="ghost" size="icon" className="dark:hidden" aria-label={t("toDark")} onClick={() => setTheme("dark")}><Moon /></Button>
      <Button variant="ghost" size="icon" className="hidden dark:inline-flex" aria-label={t("toLight")} onClick={() => setTheme("light")}><Sun /></Button>
    </>
  );
}
