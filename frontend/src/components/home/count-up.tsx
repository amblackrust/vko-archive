"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Число, «набегающее» до значения при первом показе. На сервере и без JS выводится сразу итог;
 * при prefers-reduced-motion анимации нет.
 */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    done.current = true;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / 900);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString("ru-RU")}</>;
}
