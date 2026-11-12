"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  // The accessibility panel can force reduced motion on top of the OS setting.
  const [forceReduce, setForceReduce] = useState(false);
  useEffect(() => {
    const sync = () => setForceReduce(document.documentElement.dataset.motion === "reduce");
    sync();
    window.addEventListener("a11y-change", sync);
    return () => window.removeEventListener("a11y-change", sync);
  }, []);

  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion={forceReduce ? "always" : "user"}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
