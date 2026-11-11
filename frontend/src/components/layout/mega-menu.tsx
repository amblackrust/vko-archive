"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-config";

/**
 * Меню разделов в шапке: панели раскрываются по клику/hover/клавиатуре, закрываются по Esc и клику вне.
 * Каталог открывается отдельной кнопкой, поэтому его группы здесь нет (в боковом меню она есть).
 */
export function MegaMenu() {
  const t = useTranslations("layout");
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => setOpenId(null), [pathname]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav ref={rootRef} aria-label={t("menu.main")} className="hidden self-stretch lg:block">
      <ul className="flex h-full items-stretch">
        {navGroups.filter((group) => group.id !== "catalog").map((group) => {
          const isOpen = openId === group.id;
          const isCurrent = group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={group.id} className="relative flex" onMouseEnter={() => setOpenId(group.id)} onMouseLeave={() => setOpenId(null)}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`mega-${group.id}`}
                onClick={() => setOpenId(isOpen ? null : group.id)}
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap border-b-2 border-transparent px-2.5 text-[0.9375rem] font-medium hover:text-primary xl:px-4",
                  (isOpen || isCurrent) && "border-primary text-primary",
                )}
              >
                {t(`nav.groups.${group.id}`)}
                <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
              <div id={`mega-${group.id}`} hidden={!isOpen} className="absolute left-0 top-full z-40 w-80 pt-2">
                <ul className="rounded-lg bg-surface p-2 shadow-[0_12px_32px_-8px_rgb(18_26_43/0.22)] ring-1 ring-border animate-in fade-in-0 slide-in-from-top-1 duration-150">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={pathname === item.href ? "page" : undefined}
                        className="block rounded-md px-3 py-2.5 text-[0.9375rem] hover:bg-primary-soft hover:text-primary aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary"
                      >
                        {t(`nav.items.${item.id}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
