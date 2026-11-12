"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import type { Schema } from "@/lib/api/client";
import { Sleeve } from "@/components/ui/sleeve";
import { Media } from "@/components/ui/media";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING_SHEET } from "@/lib/motion";

/** Exhibits one after another on a wall: picture and caption trade sides as you scroll; a picture opens in a viewer. */
export function ExhibitWall({ exhibits }: { exhibits: Schema["Exhibit"][] }) {
  const t = useTranslations("exhibitions");
  const [open, setOpen] = useState<number | null>(null);
  const withMedia = exhibits.map((e, i) => ({ e, i })).filter((x) => x.e.media?.mime?.startsWith("image/"));
  const pos = open === null ? -1 : withMedia.findIndex((x) => x.i === open);
  const go = (d: number) => setOpen(withMedia[(pos + d + withMedia.length) % withMedia.length].i);
  const cur = open === null ? null : exhibits[open];

  return (
    <>
      <ol className="space-y-24 md:space-y-32">
        {exhibits.map((e, i) => (
          <li key={e.id} className={clsx("wrap grid items-center gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]", i % 2 && "lg:[&>*:first-child]:order-2")}>
            <div>
              {e.media?.mime?.startsWith("image/") ? (
                <button type="button" onClick={() => setOpen(i)} className="block w-full cursor-zoom-in text-left" aria-label={e.title}>
                  <Sleeve>
                    <div className="overflow-hidden rounded-[5px] bg-sleeve-2"><Media src={e.media.preview_url ?? e.media.url} alt={e.title} className="max-h-[70dvh] w-full object-contain transition-transform duration-700 ease-(--ease-out) hover:scale-[1.02]" /></div>
                  </Sleeve>
                </button>
              ) : e.video_url ? (
                <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="grid aspect-video place-items-center rounded-[28px] bg-sleeve text-[oklch(96%_0.005_240)] no-underline">{t("video")} <ArrowUpRight size={18} aria-hidden /></a>
              ) : null}
            </div>
            <div>
              <p className="tnum font-display text-7xl font-light leading-none tracking-[-0.05em] text-edge-text md:text-8xl">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{e.title}</h2>
              {e.caption && <p className="mt-4 max-w-[54ch] text-lg leading-relaxed text-ink-2">{e.caption}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-3">
                {e.source && <span>{t("source")}: {e.source}</span>}
                {e.archive_code && <span className="edge">{e.archive_code}</span>}
                {e.document_href && <Link href={e.document_href} className="inline-flex items-center gap-1 text-action">{t("toDocument")} <ArrowUpRight size={14} aria-hidden /></Link>}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Dialog.Root open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <AnimatePresence>
          {cur && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount><motion.div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div className="fixed inset-0 z-50 grid place-items-center p-4 text-white md:p-10" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={SPRING_SHEET}>
                  <Dialog.Title className="sr-only">{cur.title}</Dialog.Title>
                  <Media src={cur.media?.url} alt={cur.title} className="max-h-[80dvh] max-w-full object-contain" loading="eager" />
                  <p className="mt-4 max-w-[70ch] text-center text-sm opacity-80">{cur.title}{cur.caption ? ` — ${cur.caption}` : ""}</p>
                  <div className="absolute right-4 top-4"><Dialog.Close asChild><IconButton label="×" className="!text-white hover:!bg-white/15"><X size={20} /></IconButton></Dialog.Close></div>
                  {withMedia.length > 1 && (
                    <>
                      <IconButton label={t("prev")} onClick={() => go(-1)} className="absolute left-3 top-1/2 !text-white hover:!bg-white/15"><ChevronLeft size={24} /></IconButton>
                      <IconButton label={t("next")} onClick={() => go(1)} className="absolute right-3 top-1/2 !text-white hover:!bg-white/15"><ChevronRight size={24} /></IconButton>
                    </>
                  )}
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
