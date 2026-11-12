"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import { Link } from "@/i18n/navigation";
import { SPRING_BOUNCY, SPRING_SNAPPY } from "@/lib/motion";

const TONES = {
  action: "bg-action text-action-ink",
  ochre: "bg-ochre text-[oklch(20%_0.04_80)]",
  postmark: "bg-postmark text-[oklch(98%_0.01_90)]",
  sage: "bg-sage text-[oklch(98%_0.01_90)]",
} as const;

export type StampTone = keyof typeof TONES;

type Props = {
  href: string;
  title: string;
  /** Large engraved figure: a period, a year or a count. */
  figure?: string;
  note?: string;
  image?: string;
  tone?: StampTone;
  /** Position in the entrance sequence. */
  index?: number;
  className?: string;
};

/** A shelf item: a photo or an ink-printed face in a white frame. Lifts on hover, presses on touch. */
export function Stamp({ href, title, figure, note, image, tone = "action", index = 0, className }: Props) {
  return (
    <motion.li
      className={clsx("shrink-0 snap-start", className)}
      // Hand-placed feel: each item settles from a slight tilt, one after another.
      initial={{ opacity: 0, y: 36, rotate: index % 2 ? 1.6 : -1.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...SPRING_BOUNCY, delay: 0.25 + index * 0.07 }}
    >
      <motion.div
        style={{ filter: "drop-shadow(0 1px 1.5px oklch(20% 0.03 262 / 0.2)) drop-shadow(0 10px 14px oklch(20% 0.03 262 / 0.16))" }}
        whileHover={{ y: -8, transition: SPRING_SNAPPY }}
        whileTap={{ scale: 0.97, transition: { duration: 0.08 } }}
        className="h-full"
      >
        <Link
          href={href}
          draggable={false}
          className="group relative block h-full w-full overflow-hidden rounded-[24px] bg-paper p-2 no-underline"
        >
          <span className={clsx("relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[17px]", !image && TONES[tone])}>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                draggable={false}
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-(--ease-out) group-hover:scale-[1.04]"
              />
            )}
            {image && <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />}
            <span className={clsx("relative p-4", image && "text-white")}>
              {figure && (
                <span className="block whitespace-nowrap font-display text-[2rem] leading-none tracking-[-0.03em]">
                  {figure}
                </span>
              )}
            </span>
            <span className={clsx("relative p-4", image && "text-white")}>
              <span className="block font-display text-[1.45rem] leading-[1.1] tracking-[-0.025em]">{title}</span>
              {note && <span className="mt-1.5 block text-sm opacity-80">{note}</span>}
            </span>
          </span>
        </Link>
      </motion.div>
    </motion.li>
  );
}
