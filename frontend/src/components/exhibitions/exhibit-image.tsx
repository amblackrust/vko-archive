"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fileUrl } from "@/lib/api/document";

const STEPS = [1, 1.5, 2, 3, 4];

/** Изображение экспоната с кнопочным зумом (прокрутка внутри рамки; работает с клавиатуры). */
export function ExhibitImage({ url, alt }: { url: string; alt: string }) {
  const t = useTranslations("exhibitions.exhibit");
  const [step, setStep] = useState(0);
  const zoom = STEPS[step];
  return (
    <figure className="space-y-2">
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-surface-muted" tabIndex={0} aria-label={alt}>
        {/* eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав */}
        <img src={fileUrl(url)} alt={alt} draggable={false} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block h-auto select-none" />
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("zoomLabel", { percent: zoom * 100 })}>
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <Minus aria-hidden /> {t("zoomOut")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
          <Plus aria-hidden /> {t("zoomIn")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStep(0)} disabled={step === 0}>
          <RotateCcw aria-hidden /> {t("zoomReset")}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">{zoom * 100}%</span>
      </div>
    </figure>
  );
}
