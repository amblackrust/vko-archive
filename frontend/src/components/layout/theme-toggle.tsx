"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const t = useTranslations("layout.theme");
  const { setTheme } = useTheme();
  // Иконку и действие переключают CSS-классы dark:, а не состояние React,
  // поэтому нет рассинхрона при гидратации и смена темы не перезагружает страницу.
  return (
    <>
      <Button variant="ghost" size="icon" className="dark:hidden" aria-label={t("toDark")} onClick={() => setTheme("dark")}>
        <Moon />
      </Button>
      <Button variant="ghost" size="icon" className="hidden dark:inline-flex" aria-label={t("toLight")} onClick={() => setTheme("light")}>
        <Sun />
      </Button>
    </>
  );
}
