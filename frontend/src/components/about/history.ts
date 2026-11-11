import { plainText, topBlocks } from "./html";

export interface HistoryBlock {
  html: string;
  /** Год, с которого начинается новый отрезок текста; null — абзац продолжает предыдущий. */
  year: number | null;
}

export interface HistoryPeriod {
  /** 1940, 1950…; 0 — вступление до первого названного года. */
  decade: number;
  blocks: HistoryBlock[];
}

// Год основания архива — 1940, поэтому более ранние числа в тексте годами событий не считаем.
const YEAR = /(?<!\d)(19[4-9]\d|20[0-4]\d)(?!\d)/;

/**
 * Делит историческую справку на десятилетия по первому году, названному в абзаце. Абзацы без года
 * (перечни, пояснения) остаются в текущем десятилетии. null — годы не распознаны (другой язык или
 * другая разметка): страница покажет текст сплошным чтением.
 */
export function historyPeriods(html: string): HistoryPeriod[] | null {
  const blocks = topBlocks(html);
  if (!blocks) return null;
  const periods: HistoryPeriod[] = [];
  let lastYear = 0;
  for (const block of blocks) {
    const found = Number(plainText(block).match(YEAR)?.[1] ?? 0);
    const decade = Math.floor(found / 10) * 10;
    const current = periods[periods.length - 1];
    if (!current || decade > current.decade) periods.push({ decade, blocks: [] });
    const isNew = found > lastYear;
    if (isNew) lastYear = found;
    periods[periods.length - 1].blocks.push({ html: block, year: isNew ? found : null });
  }
  return periods.length >= 3 ? periods : null;
}
