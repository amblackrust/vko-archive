/**
 * Сетка без пустых ячеек: число колонок, при котором последний ряд заполнен целиком.
 * `closing` — ряд закрывает плитка-переход («все …»), её добавляет вызывающий.
 */
export function evenGrid(count: number, options: number[] = [4, 3]): { cols: number; closing: boolean } {
  for (const cols of options) if (count % cols === 0) return { cols, closing: false };
  for (const cols of options) if ((count + 1) % cols === 0) return { cols, closing: true };
  if (count <= 2) return { cols: 2, closing: count === 1 };
  return { cols: options[0], closing: false };
}

/** Плитки с изображением (коллекции, документы): на телефоне в две колонки, полное число — на настольном экране. */
export const TILE_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};
