"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "@/i18n/navigation";
import { GROUPS, PRIMARY } from "@/lib/nav";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING_SHEET } from "@/lib/motion";

type Entry = { href: string; label: string };

/** Quick jump anywhere: type to filter sections, or press Enter to search the archive. */
export function CommandMenu() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sections = useMemo<Entry[]>(() => {
    const seen = new Map<string, Entry>();
    for (const item of PRIMARY) seen.set(item.href, { href: item.href, label: t(`nav.primary.${item.key}`) });
    for (const group of GROUPS)
      for (const item of group.items)
        if (!seen.has(item.href)) seen.set(item.href, { href: item.href, label: t(`nav.items.${item.key}`) });
    return [...seen.values()];
  }, [t]);

  const q = query.trim();
  const matches = q ? sections.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())) : sections;
  const searchEntry: Entry | null = q ? { href: `/search?q=${encodeURIComponent(q)}`, label: q } : null;
  const rows: Entry[] = searchEntry ? [searchEntry, ...matches] : matches;

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };
  const go = (entry: Entry) => {
    close();
    router.push(entry.href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Dialog.Trigger asChild>
        <IconButton label={`${t("common.search")} (Ctrl K)`}>
          <Search size={18} />
        </IconButton>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="glassine fixed left-1/2 top-[12vh] z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-frame shadow-lift-high"
                initial={{ opacity: 0, scale: 0.95, y: -12, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.97, y: -6, filter: "blur(4px)" }}
                transition={SPRING_SHEET}
              >
                <Dialog.Title className="sr-only">{t("common.search")}</Dialog.Title>
                <div className="flex items-center gap-3 border-b border-frame px-5">
                  <Search size={20} className="text-ink-3" aria-hidden />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((i) => Math.min(i + 1, rows.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((i) => Math.max(i - 1, 0));
                      } else if (e.key === "Enter" && rows[active]) {
                        e.preventDefault();
                        go(rows[active]);
                      }
                    }}
                    placeholder={t("home.searchPlaceholder")}
                    aria-label={t("common.search")}
                    className="h-16 flex-1 bg-transparent text-xl outline-none placeholder:text-ink-3"
                  />
                </div>
                <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                  {rows.map((row, i) => (
                    <li key={row.href + i} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(row)}
                        className={clsx(
                          "flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors",
                          i === active && "bg-action text-action-ink",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          {row === searchEntry ? <Search size={16} /> : <ArrowUpRight size={16} className={i === active ? "" : "text-ink-3"} />}
                          {row.label}
                        </span>
                        {i === active && <CornerDownLeft size={14} aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
