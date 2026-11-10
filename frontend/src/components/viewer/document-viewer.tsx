"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fileUrl, type DocumentFile } from "@/lib/api/document";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP = 0.5;

const isImage = (file: DocumentFile) => file.mime.startsWith("image/");
const isAudio = (file: DocumentFile) => file.mime.startsWith("audio/");
const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

interface Props {
  /** Файлы, которые сервер разрешил показать этому посетителю (страницы документа по порядку). */
  files: DocumentFile[];
  title: string;
}

/**
 * Просмотрщик: страницы = файлы документа. Картинки показываются через /api/files/{id}
 * (превью, а при увеличении и в полноэкранном режиме — оригинал). PDF встроенным просмотрщиком
 * браузера не открывается (CSP sandbox на /api/files), поэтому для него — превью-картинка, если есть,
 * и ссылки «открыть»/«скачать».
 */
export function DocumentViewer({ files, title }: Props) {
  const t = useTranslations("document.viewer");
  const o = useTranslations("document.sections");
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const file = files[index];
  const total = files.length;
  const previewable = isImage(file) || (file.preview_url !== null && !isAudio(file));
  const highRes = zoom > 1 || fullscreen;
  const src = fileUrl(isImage(file) && highRes ? file.url : (file.preview_url ?? file.url));

  const go = useCallback(
    (next: number) => {
      setIndex(Math.min(total - 1, Math.max(0, next)));
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setFailed(false);
    },
    [total],
  );

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) => {
      const next = clamp(current + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Колесо меняет масштаб только над изображением; слушатель не passive, чтобы страница не прокручивалась.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? STEP : -STEP);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [changeZoom, index, previewable]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      // Браузер может запретить полноэкранный режим (iframe, настройки) — просмотр остаётся обычным.
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "ArrowRight") go(index + 1);
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

  const label = file.caption || t("page", { current: index + 1, total });

  return (
    <section aria-label={t("label")} className="space-y-3">
      <h2 className="text-xl font-semibold">{o("viewer")}</h2>
      <div
        ref={root}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={`rounded-lg border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary ${fullscreen ? "flex h-full flex-col" : ""}`}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t("prev")}>
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-28 text-center text-sm" aria-live="polite">{t("page", { current: index + 1, total })}</span>
            <Button variant="outline" size="icon" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label={t("next")}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {isImage(file) && (
              <>
                <Button variant="outline" size="icon" onClick={() => changeZoom(-STEP)} disabled={zoom <= MIN_ZOOM} aria-label={t("zoomOut")}>
                  <Minus aria-hidden />
                </Button>
                <span className="min-w-12 text-center text-sm" aria-label={t("zoom", { percent: Math.round(zoom * 100) })}>{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="icon" onClick={() => changeZoom(STEP)} disabled={zoom >= MAX_ZOOM} aria-label={t("zoomIn")}>
                  <Plus aria-hidden />
                </Button>
                <Button variant="outline" size="icon" onClick={reset} disabled={zoom === 1} aria-label={t("zoomReset")}>
                  <RotateCcw aria-hidden />
                </Button>
              </>
            )}
            <Button variant="outline" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}>
              {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            </Button>
          </div>
        </div>

        <div
          ref={stage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={() => (zoom === 1 ? changeZoom(1) : reset())}
          className={`flex min-h-64 items-center justify-center overflow-hidden rounded-md bg-surface-muted ${fullscreen ? "flex-1" : "h-[28rem] max-h-[70vh]"} ${zoom > 1 ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        >
          {isAudio(file) ? (
            <div className="w-full space-y-2 p-4">
              <p className="text-sm text-muted-foreground">{t("audio")}</p>
              <audio controls preload="none" src={fileUrl(file.url)} className="w-full" />
            </div>
          ) : previewable && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав; оптимизатор Next не нужен
            <img
              key={src}
              src={src}
              alt={`${title} — ${label}`}
              draggable={false}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full select-none object-contain"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "center" }}
            />
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">{failed ? t("loadFailed") : t("noPreview")}</p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={fileUrl(file.url)} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              {t("open")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={fileUrl(file.url)} download>
              <Download aria-hidden />
              {t("download")}
            </a>
          </Button>
          {file.mime === "application/pdf" && <span className="text-xs text-muted-foreground">{t("pdfNote")}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      {total > 1 && (
        <ul aria-label={t("pages")} className="flex gap-2 overflow-x-auto pb-1">
          {files.map((item, i) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t("pageThumb", { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={`flex h-20 w-16 items-center justify-center overflow-hidden rounded-md border bg-surface-muted text-sm ${i === index ? "ring-2 ring-primary" : "hover:opacity-80"}`}
              >
                {isImage(item) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- см. выше
                  <img src={fileUrl(item.preview_url ?? item.url)} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  i + 1
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {file.ocr_text && (
        <details className="rounded-lg border bg-surface p-3">
          <summary className="cursor-pointer font-medium">{o("ocr")}</summary>
          <p className="mt-2 whitespace-pre-line text-sm">{file.ocr_text}</p>
        </details>
      )}
    </section>
  );
}
