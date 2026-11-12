// Deep panel colours with white text in both themes; one per item, cycling.
const TONES = ["oklch(42% 0.12 258)", "oklch(48% 0.16 33)", "oklch(42% 0.08 160)", "oklch(30% 0.06 262)", "oklch(40% 0.1 300)"];
export const toneBg = (i: number) => TONES[i % TONES.length];
