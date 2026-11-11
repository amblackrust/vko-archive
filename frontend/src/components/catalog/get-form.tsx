"use client";

import { useLocale } from "next-intl";
import { withQuery } from "@/lib/api/catalog";
import { useRouter } from "@/lib/i18n/navigation";

/**
 * GET-форма поиска и фильтров. Без JS уходит как обычная форма; с JS переход идёт без перезагрузки,
 * а пустые поля в адрес не попадают. Вызывающий задаёт `key` по текущим условиям: иначе после перехода
 * по ссылке (чип, сброс) поля остались бы со старыми значениями.
 */
export function GetForm({ pathname, children, ...props }: { pathname: string } & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "onSubmit">) {
  const router = useRouter();
  const locale = useLocale();
  return (
    <form
      {...props}
      action={`/${locale}${pathname}`}
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [name, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value.trim()) params.append(name, value.trim());
        router.push(withQuery(pathname, params));
      }}
    >
      {children}
    </form>
  );
}
