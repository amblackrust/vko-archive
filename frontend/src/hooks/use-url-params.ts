"use client";

import { useCallback, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

type Patch = Record<string, string | string[] | null | undefined>;

/** Reads and writes list filters in the URL. Any change resets the page; the server re-renders results. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (patch: Patch) => {
      const next = new URLSearchParams(params.toString());
      next.delete("page");
      for (const [key, value] of Object.entries(patch)) {
        next.delete(key);
        if (value === null || value === undefined || value === "") continue;
        (Array.isArray(value) ? value : [value]).forEach((v) => next.append(key, v));
      }
      const qs = next.toString();
      startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return { params, set, pending, get: (k: string) => params.get(k) ?? "", getAll: (k: string) => params.getAll(k) };
}
