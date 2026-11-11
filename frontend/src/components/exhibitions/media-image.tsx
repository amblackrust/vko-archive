"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Рамка с изображением из /api/files. Если файла нет, он не загрузился или доступ к копии закрыт,
 * вместо «битой» картинки показывается подпись `fallback`. Пропорции задаёт `className`;
 * внутри карточки рамке снимают свои углы и обводку (`rounded-none border-0`).
 */
export function MediaImage({ src, alt, fallback, eager, className }: {
  src: string | null;
  alt: string;
  fallback: string;
  eager?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  // Ошибка загрузки могла случиться до гидратации: тогда onError уже не сработает.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-lg border bg-surface-muted text-muted-foreground", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- файл отдаёт backend с проверкой прав
        <img ref={ref} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1 p-3 text-center text-sm">
          <ImageOff className="size-6" aria-hidden />
          {fallback}
        </span>
      )}
    </div>
  );
}
