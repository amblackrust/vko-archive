"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { IconButton } from "./icon-button";
import credits from "@/lib/photo-credits.json";

const KEYS = Object.keys(credits) as (keyof typeof credits)[];

/** Region photographs (open licences) in a masonry; each opens in a viewer with its author and licence. */
export function PhotoGallery() {
  const [i, setI] = useState<number | null>(null);
  const cur = i === null ? null : credits[KEYS[i]];
  const go = (d: number) => setI((x) => ((x ?? 0) + d + KEYS.length) % KEYS.length);
  return (
    <>
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 [&>li]:mb-4 [&>li]:break-inside-avoid">
        {KEYS.map((k, n) => (
          <li key={k}>
            <button type="button" onClick={() => setI(n)} className="group block w-full overflow-hidden rounded-2xl bg-table-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/photos/${k}.webp`} alt="" loading="lazy" className="w-full transition-transform duration-700 ease-(--ease-out) group-hover:scale-[1.04]" />
              <span className="sr-only">{credits[k].title}</span>
            </button>
          </li>
        ))}
      </ul>
      <Dialog.Root open={i !== null} onOpenChange={(o) => !o && setI(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 grid place-items-center p-4 text-white md:p-10">
            <Dialog.Title className="sr-only">{cur?.title}</Dialog.Title>
            {i !== null && (
              <figure className="grid max-h-full place-items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/photos/${KEYS[i]}.webp`} alt="" className="max-h-[78dvh] max-w-full rounded-lg object-contain" />
                {cur && <figcaption className="text-center text-sm opacity-80"><a href={cur.source} target="_blank" rel="noopener noreferrer" className="underline">{cur.author}</a> · {cur.license}</figcaption>}
              </figure>
            )}
            <Dialog.Close asChild><IconButton label="×" className="absolute right-4 top-4 !text-white hover:!bg-white/15"><X size={20} /></IconButton></Dialog.Close>
            <IconButton label="‹" onClick={() => go(-1)} className="absolute left-3 top-1/2 !text-white hover:!bg-white/15"><ChevronLeft size={24} /></IconButton>
            <IconButton label="›" onClick={() => go(1)} className="absolute right-3 top-1/2 !text-white hover:!bg-white/15"><ChevronRight size={24} /></IconButton>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
