"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const STEPS = [1, 1.5, 2, 3, 4];

/**
 * Просмотр экспоната. При 100 % рамка повторяет пропорции изображения; при увеличении рамка сохраняет размер,
 * а изображение сдвигается её прокруткой (касание, стрелки в фокусе) или перетаскиванием мышью.
 * Клавиши «+», «−» и «0» меняют масштаб; пока он 100 %, стрелки влево и вправо листают экспонаты.
 */
export function ExhibitViewer({ src, alt, prevHref, nextHref, children }: {
  src: string | null;
  alt: string;
  prevHref?: string;
  nextHref?: string;
  /** Что показать в рамке, если изображения нет или оно не загрузилось. */
  children: React.ReactNode;
}) {
  const t = useTranslations("exhibitions.viewer");
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const centre = useRef({ x: 0.5, y: 0.5 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [step, setStep] = useState(0);
  /** Размеры при 100 %: ширина изображения и высота рамки, от которых считается увеличение. */
  const [base, setBase] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const zoom = STEPS[step];
  const shown = Boolean(src) && !failed;

  function zoomTo(next: number) {
    const box = stage.current;
    const width = image.current?.clientWidth;
    // Пока изображение не загрузилось, его размер неизвестен: увеличивать нечего.
    if (!box || !width || next === step || next < 0 || next >= STEPS.length) return;
    if (step === 0) setBase({ width, height: box.offsetHeight });
    // Точка изображения, которая была в центре рамки, остаётся в центре и после смены масштаба.
    centre.current = { x: (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth, y: (box.scrollTop + box.clientHeight / 2) / box.scrollHeight };
    setStep(next);
  }
  useLayoutEffect(() => {
    const box = stage.current;
    if (!box) return;
    box.scrollLeft = centre.current.x * box.scrollWidth - box.clientWidth / 2;
    box.scrollTop = centre.current.y * box.scrollHeight - box.clientHeight / 2;
  }, [step]);

  // Без массива зависимостей: обработчик каждый раз видит текущий масштаб и адреса соседних экспонатов.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]")) return;
      if (event.key === "+" || event.key === "=") zoomTo(step + 1);
      else if (event.key === "-") zoomTo(step - 1);
      else if (event.key === "0") zoomTo(0);
      else if (step === 0 && event.key === "ArrowLeft" && prevHref) router.push(prevHref, { scroll: false });
      else if (step === 0 && event.key === "ArrowRight" && nextHref) router.push(nextHref, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <figure className="space-y-3">
      <div
        ref={stage}
        tabIndex={shown ? 0 : undefined}
        role={shown ? "group" : undefined}
        aria-label={shown ? t("stage") : undefined}
        style={zoom > 1 && base ? { height: base.height } : undefined}
        className={cn("card flex min-h-72 overflow-auto", zoom > 1 && "cursor-grab")}
        onDoubleClick={() => zoomTo(step === 0 ? 2 : 0)}
        onPointerDown={(event) => {
          // Только мышь и только по самому изображению: касание и полосы прокрутки работают штатно.
          if (zoom === 1 || event.pointerType !== "mouse" || event.target !== image.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
          event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
          <img
            ref={image}
            src={src!}
            alt={alt}
            fetchPriority="high"
            draggable={false}
            onError={() => setFailed(true)}
            style={zoom > 1 && base ? { width: base.width * zoom } : undefined}
            className={cn("m-auto block shrink-0 select-none", zoom > 1 && base ? "max-w-none" : "max-h-[75vh] max-w-full")}
          />
        ) : (
          <div className="m-auto flex max-w-md flex-col items-center gap-3 p-6 text-center text-muted-foreground">{children}</div>
        )}
      </div>
      {shown && (
        <>
          <div role="group" aria-label={t("zoom")} className="flex flex-wrap items-center gap-2" data-noprint>
            <Button variant="outline" size="icon" className="size-11" onClick={() => zoomTo(step - 1)} disabled={step === 0} aria-label={t("zoomOut")} title={t("zoomOut")}>
              <Minus aria-hidden />
            </Button>
            <span role="status" className="min-w-14 text-center text-sm font-medium tabular-nums">{zoom * 100}%</span>
            <Button variant="outline" size="icon" className="size-11" onClick={() => zoomTo(step + 1)} disabled={step === STEPS.length - 1} aria-label={t("zoomIn")} title={t("zoomIn")}>
              <Plus aria-hidden />
            </Button>
            <Button variant="ghost" onClick={() => zoomTo(0)} disabled={step === 0}>
              <RotateCcw aria-hidden />
              {t("zoomReset")}
            </Button>
          </div>
          {/* Подсказка про клавиши нужна только там, где есть клавиатура. */}
          <figcaption className="hidden text-sm text-muted-foreground md:block" data-noprint>{t("hint")}</figcaption>
        </>
      )}
    </figure>
  );
}
