"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Класс .dark на <html>, выбор хранится в localStorage, по умолчанию — системная тема. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
