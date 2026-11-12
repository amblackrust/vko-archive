"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING_BOUNCY } from "@/lib/motion";

export function ThemeSwitch() {
  const t = useTranslations("common.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = dark ? "light" : "dark";
    const rect = e.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${rect.left + rect.width / 2}px`);
    root.style.setProperty("--vt-y", `${rect.top + rect.height / 2}px`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduce";
    if (!document.startViewTransition || reduce) return setTheme(next);
    // The new theme opens as a circle from the button.
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  };

  return (
    <IconButton label={`${t("label")}: ${dark ? t("light") : t("dark")}`} onClick={toggle}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={{ rotate: -80, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 80, scale: 0.4, opacity: 0 }}
          transition={SPRING_BOUNCY}
          className="grid place-items-center"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </IconButton>
  );
}
