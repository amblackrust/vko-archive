"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Выпадающее меню шапки (сайт и админка): закрывается по Esc, щелчку вне меню и после выбора ссылки или пункта с data-close. */
export function Menu({ label, trigger, className, panelClassName, children }: {
  label: string;
  trigger: React.ReactNode;
  className?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)} className={cn("flex min-h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-surface-muted", open && "bg-surface-muted", className)}>
        {trigger}
      </button>
      {open && (
        <div
          className={cn("absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border bg-surface p-1.5 shadow-[0_16px_40px_-12px_rgb(18_26_43/0.3)] animate-in fade-in zoom-in-95 duration-150", panelClassName)}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a, [data-close]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const menuItem = "flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-[0.9375rem] font-medium transition-colors hover:bg-surface-muted";
