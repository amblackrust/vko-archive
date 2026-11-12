import type { Transition } from "motion/react";

// Apple-style springs: damping 1 settles without overshoot; bounce only after momentum.
export const SPRING: Transition = { type: "spring", visualDuration: 0.4, bounce: 0 };
export const SPRING_SNAPPY: Transition = { type: "spring", visualDuration: 0.3, bounce: 0 };
export const SPRING_SHEET: Transition = { type: "spring", visualDuration: 0.45, bounce: 0.12 };
export const SPRING_BOUNCY: Transition = { type: "spring", visualDuration: 0.5, bounce: 0.25 };

/** Where a flick will come to rest: Apple's deceleration projection (rate 0.998). */
export function project(velocity: number, rate = 0.998): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}
