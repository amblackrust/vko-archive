"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Класс .dark на <html>, выбор хранится в localStorage, по умолчанию — светлая тема; тёмную и системную посетитель включает сам. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
