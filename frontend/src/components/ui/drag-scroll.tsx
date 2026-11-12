"use client";

import { useRef } from "react";
import { animate } from "motion/react";
import { project } from "@/lib/motion";

/** Horizontal scroller: native scroll for touch, wheel and keys; mouse drag adds momentum like a thrown card. */
export function DragScroll({ children, className, label, as: Tag = "ul", innerRef }: { children: React.ReactNode; className?: string; label?: string; as?: "ul" | "div"; innerRef?: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLElement | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);
  const flight = useRef<{ stop: () => void } | null>(null);

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";

  const settle = (target: number, velocity: number) => {
    const el = ref.current;
    if (!el) return;
    const to = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target));
    flight.current?.stop();
    if (reduced()) {
      el.scrollLeft = to;
      return;
    }
    flight.current = animate(el.scrollLeft, to, { type: "spring", visualDuration: 0.6, bounce: 0, velocity, onUpdate: (v) => (el.scrollLeft = v) });
  };

  const Any = Tag as React.ElementType;
  return (
    <Any
      ref={(el: HTMLElement | null) => {
        ref.current = el;
        if (innerRef) (innerRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }}
      aria-label={label}
      tabIndex={0}
      onPointerDown={(e: React.PointerEvent) => {
        if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
        flight.current?.stop();
        drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
        ref.current.dataset.dragging = "true";
      }}
      onPointerMove={(e: React.PointerEvent) => {
        const d = drag.current;
        if (!d || !ref.current) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) < 6) return;
        if (!d.moved) ref.current.setPointerCapture(e.pointerId);
        d.moved = true;
        ref.current.scrollLeft = d.left - dx; // 1:1 with the pointer
        d.samples.push({ x: e.clientX, t: performance.now() });
        if (d.samples.length > 6) d.samples.shift();
      }}
      onPointerUp={() => {
        const d = drag.current;
        const el = ref.current;
        drag.current = null;
        if (!el) return;
        delete el.dataset.dragging;
        if (!d?.moved) return;
        const a = d.samples[0];
        const b = d.samples[d.samples.length - 1];
        const v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
        settle(el.scrollLeft + project(-v, 0.996), -v); // land where the flick is heading
      }}
      onClickCapture={(e: React.MouseEvent) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`flex overflow-x-auto overscroll-x-contain py-4 [scrollbar-width:none] data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none md:cursor-grab [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
    >
      {children}
    </Any>
  );
}
