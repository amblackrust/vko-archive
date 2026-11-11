"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fileUrl, type DocumentFile } from "@/lib/api/document";
import { cn } from "@/lib/utils";
import { PdfPageCanvas, PdfThumb, usePdfDocument } from "./pdf-view";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP = 0.5;
const MAX_PDF_THUMBS = 60;

const isImage = (file: DocumentFile) => file.mime.startsWith("image/");
const isPdf = (file: DocumentFile) => file.mime === "application/pdf";
const isAudio = (file: DocumentFile) => file.mime.startsWith("audio/");
const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** Лента миниатюр: листы документа или страницы PDF. */
function Thumbs({ label, count, current, onSelect, title, children }: {
  label: string;
  count: number;
  current: number;
  onSelect: (index: number) => void;
  title: (index: number) => string;
  children: (index: number) => React.ReactNode;
}) {
  return (
    <ul aria-label={label} className="flex gap-2 overflow-x-auto p-1">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="shrink-0">
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-label={title(index)}
            aria-current={index === current ? "true" : undefined}
            className={cn(
              "flex h-20 w-16 items-center justify-center overflow-hidden rounded-md border bg-surface-muted text-sm tabular-nums",
              index === current ? "border-primary outline-2 outline-primary" : "hover:border-border-strong",
            )}
          >
            {children(index)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Просмотрщик: листы = файлы документа, которые сервер разрешил показать этому посетителю.
 * Картинки идут через /api/files/{id} (превью, при увеличении и на весь экран — оригинал). PDF рисует pdf.js
 * (CSP sandbox на /api/files не даёт встроить его средствами браузера), аудио — штатный плеер.
 * Клавиши: стрелки листают, «+», «−» и «0» меняют масштаб.
 */
export function DocumentViewer({ files, title }: { files: DocumentFile[]; title: string }) {
  const t = useTranslations("document.viewer");
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const hintId = useId();

  const file = files[index];
  const total = files.length;
  const pdf = usePdfDocument(isPdf(file) ? fileUrl(file.url) : null);
  const pdfPages = pdf.status === "ready" ? pdf.doc.numPages : 0;
  const zoomable = isImage(file) || isPdf(file);
  const src = fileUrl(isImage(file) && (zoom > 1 || fullscreen) ? file.url : (file.preview_url ?? file.url));
  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const go = (next: number) => {
    setIndex(Math.min(total - 1, Math.max(0, next)));
    setPdfPage(1);
    setFailed(false);
    reset();
  };

  const goPdfPage = (next: number) => {
    setPdfPage(Math.min(pdfPages, Math.max(1, next)));
    reset();
  };

  // Стрелки листают страницы PDF, а на их краях переходят к соседнему файлу.
  const step = (delta: number) => {
    if (pdfPages > 0 && pdfPage + delta >= 1 && pdfPage + delta <= pdfPages) goPdfPage(pdfPage + delta);
    else go(index + delta);
  };
  const atStart = index === 0 && (pdfPages === 0 || pdfPage === 1);
  const atEnd = index === total - 1 && (pdfPages === 0 || pdfPage === pdfPages);
  const position = pdfPages > 0 ? t("page", { current: pdfPage, total: pdfPages }) : t("sheet", { current: index + 1, total });

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) => {
      const next = clamp(current + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Колесо меняет масштаб только с Ctrl/⌘ (жест «щипок» на тачпаде) или на весь экран: иначе большой просмотрщик
  // перехватывал бы прокрутку страницы. Слушатель не passive, чтобы отменить масштабирование самой страницы.
  useEffect(() => {
    const element = stage.current;
    if (!element || !zoomable) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && !fullscreen) return;
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? STEP : -STEP);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [changeZoom, fullscreen, zoomable]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      // Браузер может запретить полноэкранный режим (iframe, настройки) — просмотр остаётся обычным.
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // У аудиоплеера стрелки перематывают запись — не перехватываем.
    if (event.target instanceof HTMLMediaElement) return;
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    else if (event.key === "+" || event.key === "=") changeZoom(STEP);
    else if (event.key === "-") changeZoom(-STEP);
    else if (event.key === "0") reset();
    else return;
    event.preventDefault();
  }

  function onPointerDown(event: React.PointerEvent) {
    if (zoom === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = drag.current;
    if (start) setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + event.clientY - start.y });
  }

  const alt = file.caption || `${title}, ${position}`;
  const onPdfError = useCallback(() => setFailed(true), []);
  const arrow = "absolute top-1/2 size-11 -translate-y-1/2 bg-surface";

  return (
    <section aria-labelledby={`${hintId}-title`} className="space-y-3">
      <h2 id={`${hintId}-title`} className="sr-only">{t("title")}</h2>
      <div
        ref={root}
        role="group"
        aria-labelledby={`${hintId}-title`}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn("overflow-hidden card", fullscreen && "flex h-full flex-col rounded-none border-0")}
      >
        <div className={cn("relative bg-surface-muted", fullscreen ? "min-h-0 flex-1" : !isAudio(file) && "h-[min(70vh,44rem)] min-h-72")}>
          <div
            ref={stage}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onDoubleClick={() => zoomable && (zoom === 1 ? changeZoom(1) : reset())}
            className={cn("flex size-full items-center justify-center overflow-hidden", zoom > 1 && "cursor-grab touch-none active:cursor-grabbing")}
          >
            {isAudio(file) ? (
              <div className="w-full max-w-xl space-y-3 p-6">
                <p className="font-medium">{file.caption || t("audio")}</p>
                <audio controls preload="none" src={fileUrl(file.url)} className="w-full" />
              </div>
            ) : failed || pdf.status === "error" ? (
              <p role="alert" className="p-6 text-center text-muted-foreground">{t("loadFailed")}</p>
            ) : isPdf(file) ? (
              pdf.status === "ready" ? (
                <PdfPageCanvas doc={pdf.doc} page={pdfPage} zoom={zoom} alt={alt} transform={transform} onError={onPdfError} />
              ) : (
                <p role="status" className="p-6 text-center text-muted-foreground">{t("loading")}</p>
              )
            ) : isImage(file) || file.preview_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав; оптимизатор Next не нужен
              <img
                key={src}
                src={src}
                fetchPriority="high"
                decoding="async"
                alt={alt}
                draggable={false}
                onError={() => setFailed(true)}
                className="max-h-full max-w-full select-none object-contain"
                style={{ transform, transformOrigin: "center" }}
              />
            ) : (
              <p className="p-6 text-center text-muted-foreground">{t("noPreview")}</p>
            )}
          </div>
          {/* Стрелки лежат вне области перетаскивания: быстрые нажатия не должны срабатывать как двойной щелчок по листу. */}
          {!(atStart && atEnd) && (
            <>
              <Button variant="outline" size="icon" onClick={() => step(-1)} disabled={atStart} aria-label={t("prev")} className={cn(arrow, "left-2")}>
                <ChevronLeft aria-hidden />
              </Button>
              <Button variant="outline" size="icon" onClick={() => step(1)} disabled={atEnd} aria-label={t("next")} className={cn(arrow, "right-2")}>
                <ChevronRight aria-hidden />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2">
          <p aria-live="polite" className="text-sm font-medium tabular-nums">{position}</p>
          <div className="flex items-center gap-1">
            {zoomable && (
              <>
                <Button variant="ghost" size="icon" onClick={() => changeZoom(-STEP)} disabled={zoom <= MIN_ZOOM} aria-label={t("zoomOut")}>
                  <Minus aria-hidden />
                </Button>
                <span className="min-w-12 text-center text-sm tabular-nums" aria-label={t("zoom", { percent: Math.round(zoom * 100) })}>{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => changeZoom(STEP)} disabled={zoom >= MAX_ZOOM} aria-label={t("zoomIn")}>
                  <Plus aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" onClick={reset} disabled={zoom === 1} aria-label={t("zoomReset")}>
                  <RotateCcw aria-hidden />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}>
              {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="h-10">
              <a href={fileUrl(file.url)} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {t("open")}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-10">
              <a href={fileUrl(file.url)} download>
                <Download aria-hidden />
                {t("download")}
              </a>
            </Button>
          </div>
        </div>
      </div>

      {total > 1 && (
        <Thumbs label={t("sheets")} count={total} current={index} onSelect={go} title={(i) => t("sheetThumb", { n: i + 1 })}>
          {(i) =>
            isImage(files[i]) ? (
              // eslint-disable-next-line @next/next/no-img-element -- см. выше
              <img src={fileUrl(files[i].preview_url ?? files[i].url)} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              i + 1
            )
          }
        </Thumbs>
      )}
      {pdf.status === "ready" && pdfPages > 1 && (
        <Thumbs label={t("pages")} count={Math.min(pdfPages, MAX_PDF_THUMBS)} current={pdfPage - 1} onSelect={(i) => goPdfPage(i + 1)} title={(i) => t("pageThumb", { n: i + 1 })}>
          {(i) => <PdfThumb doc={pdf.doc} page={i + 1} />}
        </Thumbs>
      )}

      {file.caption && !isAudio(file) && <p className="text-sm">{file.caption}</p>}
      <p id={hintId} className="text-xs text-muted-foreground" data-noprint>{t("hint")}</p>
      {file.ocr_text && (
        <details className="card group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold hover:text-primary [&::-webkit-details-marker]:hidden">
            {t("ocr")}
            <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t p-4">
            <p className="text-xs text-muted-foreground">{t("ocrNote")}</p>
            <p className="reading whitespace-pre-line">{file.ocr_text}</p>
          </div>
        </details>
      )}
    </section>
  );
}
