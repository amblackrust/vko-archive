"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

/** Предел стороны холста: больше браузеры режут холст или тратят слишком много памяти. */
const MAX_CANVAS_SIDE = 4096;

type PdfModule = typeof import("pdfjs-dist");
let pdfModule: Promise<PdfModule> | null = null;

/** pdf.js грузится только в браузере и только при первом PDF; worker — локальный файл из бандла (CSP worker-src 'self'). */
function loadPdfjs(): Promise<PdfModule> {
  pdfModule ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    return pdfjs;
  });
  return pdfModule;
}

export type PdfState = { status: "loading" } | { status: "ready"; doc: PDFDocumentProxy } | { status: "error" };

/** Открывает PDF по адресу /api/files/{id} с cookie сессии (закрытые файлы сотрудника); url=null — ничего не грузит. */
export function usePdfDocument(url: string | null): PdfState {
  const [loaded, setLoaded] = useState<{ url: string; state: PdfState } | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    let opened: PDFDocumentProxy | null = null;
    loadPdfjs()
      .then((pdfjs) => pdfjs.getDocument({ url, withCredentials: true }).promise)
      .then((doc) => {
        if (!active) return void doc.destroy();
        opened = doc;
        setLoaded({ url, state: { status: "ready", doc } });
      })
      .catch((error) => {
        if (!active) return;
        console.warn("pdf load failed", error);
        setLoaded({ url, state: { status: "error" } });
      });
    return () => {
      active = false;
      void opened?.destroy();
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.state : { status: "loading" };
}

interface CanvasProps {
  doc: PDFDocumentProxy;
  /** Номер страницы с 1. */
  page: number;
  /** Масштаб поверх «вписать в рамку»: холст рисуется в целое число раз чётче, чтобы увеличение не размывалось. */
  zoom: number;
  alt: string;
  /** CSS-transform (сдвиг и увеличение), общий с просмотром картинок. */
  transform: string;
  onError: () => void;
}

/** Страница PDF, вписанная в родителя. Увеличение и сдвиг делает родитель через CSS-transform, как у картинок. */
export function PdfPageCanvas({ doc, page, zoom, alt, transform, onError }: CanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const quality = Math.ceil(zoom);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = canvas.current;
    if (!target || size.width === 0) return;
    let active = true;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    doc
      .getPage(page)
      .then((pdfPage) => {
        if (!active) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.min(size.width / base.width, size.height / base.height);
        const ratio = Math.min(window.devicePixelRatio || 1, 2) * quality;
        const scale = Math.min(fit * ratio, MAX_CANVAS_SIDE / Math.max(base.width, base.height));
        const viewport = pdfPage.getViewport({ scale });
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        target.style.width = `${Math.floor(base.width * fit)}px`;
        target.style.height = `${Math.floor(base.height * fit)}px`;
        task = pdfPage.render({ canvas: target, viewport });
        return task.promise;
      })
      .catch((error) => {
        // Отмена рендера при смене страницы или масштаба — штатная; прочее — сбой файла.
        if (active && error?.name !== "RenderingCancelledException") onError();
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [doc, page, quality, size, onError]);

  return (
    <div ref={box} className="flex size-full items-center justify-center">
      <canvas
        ref={canvas}
        role="img"
        aria-label={alt}
        className="select-none bg-white"
        style={{ transform, transformOrigin: "center" }}
      />
    </div>
  );
}

/** Миниатюра страницы PDF (рисуется один раз, малый размер). */
export function PdfThumb({ doc, page }: { doc: PDFDocumentProxy; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let active = true;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    doc
      .getPage(page)
      .then((pdfPage) => {
        if (!active) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: (96 / base.height) * (window.devicePixelRatio || 1) });
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        task = pdfPage.render({ canvas: target, viewport });
        return task.promise;
      })
      .catch(() => {
        // Миниатюра необязательна: без неё остаётся номер страницы на кнопке.
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [doc, page]);

  return <canvas ref={canvas} aria-hidden className="size-full bg-white object-contain" />;
}
