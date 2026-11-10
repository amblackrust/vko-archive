"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-config";

/** Десктопное мега-меню: панели раскрываются по клику/hover/клавиатуре, закрываются по Esc и клику вне. */
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
    <nav ref={rootRef} aria-label={t("menu.main")} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {navGroups.map((group) => {
          const isOpen = openId === group.id;
          return (
            <li key={group.id} className="relative" onMouseEnter={() => setOpenId(group.id)} onMouseLeave={() => setOpenId(null)}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`mega-${group.id}`}
                onClick={() => setOpenId(isOpen ? null : group.id)}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted"
              >
                {t(`nav.groups.${group.id}`)}
                <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
              <div
                id={`mega-${group.id}`}
                hidden={!isOpen}
                className="absolute left-0 top-full z-40 w-72 pt-1"
              >
                <ul className="rounded-lg border bg-surface p-2 shadow-lg">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="block rounded-md px-3 py-2 text-sm hover:bg-surface-muted">
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
