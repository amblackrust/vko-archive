"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useMotionValue, animate } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, Info, Minimize, ScanSearch, ZoomIn, ZoomOut, Maximize, X } from "lucide-react";
import clsx from "clsx";
import type { Schema } from "@/lib/api/client";
import { IconButton } from "@/components/ui/icon-button";
import { SPRING, SPRING_SHEET } from "@/lib/motion";

type File = Schema["DocumentFile"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The viewer is the page: a dark table with the sheet on it, a film strip of sheets below, and details in a drawer. */
export function DocumentStage({ files, title, drawer }: { files: File[]; title: string; drawer: React.ReactNode }) {
  const t = useTranslations("document.viewer");
  const [index, setIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loupe, setLoupe] = useState(false);
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const [lens, setLens] = useState<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const file = files[index];
  const isImage = file?.mime.startsWith("image/");

  const reset = () => {
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    animate(scale, 1, SPRING);
  };
  // A new sheet starts centred at 100%: set at once, never animate between sheets.
  useEffect(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [index, x, y, scale]);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const zoom = (factor: number) => animate(scale, clamp(scale.get() * factor, 1, 8), SPRING);
  const go = (d: number) => setIndex((i) => clamp(i + d, 0, files.length - 1));

  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  return (
    <div
      ref={stage}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
        else if (e.key === "+" || e.key === "=") zoom(1.4);
        else if (e.key === "-") zoom(1 / 1.4);
        else if (e.key === "0") reset();
      }}
      className={clsx("relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,oklch(34%_0.07_262),oklch(17%_0.04_262)_75%)] text-white", full ? "h-dvh" : "mx-[var(--gutter)] h-[min(80dvh,60rem)] min-h-[28rem] rounded-[32px] shadow-lift-high")}
      role="region"
      aria-label={t("label")}
    >
      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-28 top-0 grid place-items-center overflow-hidden"
        onWheel={(e) => {
          if (!isImage) return;
          animate(scale, clamp(scale.get() * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 8), { duration: 0.12 });
        }}
        onDoubleClick={() => (scale.get() > 1.05 ? reset() : zoom(2.4))}
        onPointerDown={(e) => {
          if (!isImage || scale.get() <= 1) return;
          drag.current = { px: e.clientX, py: e.clientY, x: x.get(), y: y.get() };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) {
            x.set(d.x + e.clientX - d.px);
            y.set(d.y + e.clientY - d.py);
          }
          if (loupe && isImage) {
            const img = e.currentTarget.querySelector("img");
            const r = img?.getBoundingClientRect();
            if (r) setLens({ x: e.clientX, y: e.clientY, rx: (e.clientX - r.left) / r.width, ry: (e.clientY - r.top) / r.height });
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => setLens(null)}
        style={{ cursor: loupe ? "none" : scale.get() > 1 ? "grab" : "zoom-in", touchAction: "none" }}
      >
        {file && isImage && (
          <motion.img
            key={file.id}
            src={file.url}
            alt={file.caption || title}
            draggable={false}
            style={{ x, y, scale }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="max-h-[92%] max-w-[92%] select-none rounded-[3px] object-contain shadow-[0_30px_70px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/15"
          />
        )}
        {file && file.mime === "application/pdf" && <iframe src={file.url} title={title} className="size-full bg-white" />}
        {file?.mime.startsWith("audio/") && <audio controls src={file.url} className="w-[min(32rem,90%)]" />}
        {file?.mime.startsWith("video/") && <video controls src={file.url} className="max-h-full max-w-full" />}
        {!file && <p className="text-[oklch(70%_0.01_240)]">{title}</p>}
        {lens && file && isImage && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-30 size-44 rounded-full border-2 border-white/80 shadow-lift-high"
            style={{ left: lens.x - 88, top: lens.y - 88, backgroundImage: `url(${file.url})`, backgroundSize: "300% auto", backgroundPosition: `${lens.rx * 100}% ${lens.ry * 100}%`, backgroundColor: "oklch(15% 0.01 250)" }}
          />
        )}
      </div>

      {/* Floating controls */}
      <div className="glass absolute left-1/2 top-4 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border border-white/15 px-1.5 py-1 text-white shadow-lift [--glass:oklch(18%_0.03_262/0.72)]">
        {files.length > 1 && (
          <>
            <IconButton label={t("prev")} onClick={() => go(-1)} disabled={index === 0} className="!text-white hover:!bg-white/10"><ChevronLeft size={18} /></IconButton>
            <span className="tnum whitespace-nowrap px-2 text-sm">{t("page", { n: index + 1, total: files.length })}</span>
            <IconButton label={t("next")} onClick={() => go(1)} disabled={index === files.length - 1} className="!text-white hover:!bg-white/10"><ChevronRight size={18} /></IconButton>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/20" />
          </>
        )}
        {isImage && (
          <>
            <IconButton label={t("zoomOut")} onClick={() => zoom(1 / 1.4)} className="!text-white hover:!bg-white/10"><ZoomOut size={18} /></IconButton>
            <IconButton label={t("zoomIn")} onClick={() => zoom(1.4)} className="!text-white hover:!bg-white/10"><ZoomIn size={18} /></IconButton>
            <IconButton label={t("fit")} onClick={reset} className="!text-white hover:!bg-white/10"><Maximize size={18} /></IconButton>
            <IconButton label={t("loupe")} aria-pressed={loupe} onClick={() => setLoupe((v) => !v)} className={clsx("!text-white hover:!bg-white/10", loupe && "!bg-white/20")}><ScanSearch size={18} /></IconButton>
          </>
        )}
        <IconButton label={full ? t("exit") : t("fullscreen")} onClick={() => (full ? document.exitFullscreen() : stage.current?.requestFullscreen())} className="!text-white hover:!bg-white/10">{full ? <Minimize size={18} /> : <Expand size={18} />}</IconButton>
        <IconButton label={title} onClick={() => setDrawerOpen((v) => !v)} aria-expanded={drawerOpen} className={clsx("!text-white hover:!bg-white/10", drawerOpen && "!bg-white/20")}><Info size={18} /></IconButton>
      </div>

      {/* Film strip of sheets */}
      {files.length > 1 && (
        <ul aria-label={t("thumbs")} className="absolute inset-x-0 bottom-0 z-10 flex h-28 items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {files.map((f, i) => (
            <li key={f.id} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={t("page", { n: i + 1, total: files.length })} aria-current={i === index} className={clsx("block h-20 overflow-hidden rounded-md border-2 transition-[transform,border-color,opacity] duration-200 ease-(--ease-spring) hover:scale-105", i === index ? "border-edge" : "border-transparent opacity-60 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.mime.startsWith("image/") ? <img src={f.preview_url ?? f.url} alt="" className="h-full w-auto object-cover" loading="lazy" /> : <span className="grid h-full w-28 place-items-center bg-sleeve-2 text-xs">{f.mime.split("/")[1]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={SPRING_SHEET}
            className="glass absolute inset-y-3 right-3 z-30 w-[min(26rem,calc(100%-1.5rem))] overflow-y-auto rounded-[26px] border border-line p-6 text-ink shadow-lift-high [--glass:var(--panel)]"
          >
            <div className="mb-4 flex justify-end">
              <IconButton label="×" onClick={() => setDrawerOpen(false)}><X size={18} /></IconButton>
            </div>
            {drawer}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
