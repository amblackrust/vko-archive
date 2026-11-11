import { cn } from "@/lib/utils";

type Fact = { label: string; value: React.ReactNode };
const filled = (items: Fact[]) => items.filter((item) => item.value !== null && item.value !== undefined && item.value !== false && item.value !== "");

/** Ключевые сведения одной полосой (срок, стоимость, годы, объём): равные ячейки, крупное значение и подпись под ним. */
export function KeyFacts({ items, className }: { items: Fact[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border shadow-card sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]", className)}>
      {filled(items).map((item) => (
        <div key={item.label} className="flex flex-col-reverse justify-end gap-1 bg-surface p-5 last:odd:col-span-2 sm:last:odd:col-span-1">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl font-bold tabular-nums text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Справочные поля карточки столбцом (боковая панель документа, фонда, филиала). Пустые поля не выводятся. */
export function FactList({ items }: { items: Fact[] }) {
  return (
    <dl className="card divide-y px-5">
      {filled(items).map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 py-3">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
