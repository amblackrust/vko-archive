"use client";

import { useRef } from "react";
import { animate } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { project } from "@/lib/motion";

type Props = { label: string; prevLabel: string; nextLabel: string; children: React.ReactNode };

/** Horizontal shelf. Native scroll for touch, wheel and keyboard; mouse drag adds momentum like a thrown card. */
export function Strip({ label, prevLabel, nextLabel, children }: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);
  const flight = useRef<{ stop: () => void } | null>(null);

  const reduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";

  const scrollTo = (target: number, velocity = 0) => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const to = Math.max(0, Math.min(max, target));
    flight.current?.stop();
    if (reduced()) {
      el.scrollLeft = to;
      return;
    }
    flight.current = animate(el.scrollLeft, to, {
      type: "spring",
      visualDuration: 0.6,
      bounce: 0,
      velocity,
      onUpdate: (v) => (el.scrollLeft = v),
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
    flight.current?.stop();
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
    ref.current.dataset.dragging = "true";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) ref.current.setPointerCapture(e.pointerId);
    d.moved = true;
    // 1:1 with the pointer, offset from where it was grabbed.
    ref.current.scrollLeft = d.left - dx;
    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  };

  const onPointerUp = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!el) return;
    delete el.dataset.dragging;
    if (!d?.moved) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0; // px/s
    // Land where the flick is heading, then hand its velocity to the spring.
    scrollTo(el.scrollLeft + project(-v, 0.996), -v);
  };

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) scrollTo(el.scrollLeft + dir * el.clientWidth * 0.8);
  };

  return (
    <div className="relative">
      <div className="absolute right-[var(--gutter)] -top-[3.9rem] hidden gap-1 md:flex">
        <IconButton label={prevLabel} onClick={() => step(-1)}>
          <ArrowLeft size={18} />
        </IconButton>
        <IconButton label={nextLabel} onClick={() => step(1)}>
          <ArrowRight size={18} />
        </IconButton>
      </div>
      <ul
        ref={ref}
        aria-label={label}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // A drag must not count as a click on the item under the pointer.
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="flex gap-5 overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-10 pt-2 [scrollbar-width:none] data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none md:cursor-grab [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </div>
  );
}
