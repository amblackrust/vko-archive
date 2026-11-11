import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Тело страницы под PageHeader: одна колонка секций во всю ширину контейнера. */
export function PageStack({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("container-page space-y-14 pb-16 pt-4", className)}>{children}</div>;
}

/**
 * Секция страницы: заголовок второго уровня, пояснение и необязательная ссылка справа от заголовка.
 * `id` — якорь; заголовок получает `${id}-title`.
 */
export function PageSection({ id, title, text, link, className, children }: {
  id: string;
  title: string;
  text?: React.ReactNode;
  link?: { href: string; label: string };
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-28", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="max-w-3xl">
          <h2 id={`${id}-title`} className="text-2xl sm:text-3xl">{title}</h2>
          {text && <p className="mt-2 text-muted-foreground">{text}</p>}
        </div>
        {link && <Link href={link.href} className="text-link font-semibold">{link.label}</Link>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

/** Плитка без перехода: название и пояснение. В сетке с `auto-rows-fr` плитки равны по высоте. */
export function InfoTile({ title, children, className, heading: Heading = "h3" }: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  heading?: "h2" | "h3";
}) {
  return (
    <div className={cn("card flex h-full flex-col gap-1.5 p-5", className)}>
      <Heading className="text-[1.0625rem] font-semibold leading-snug">{title}</Heading>
      {children && <div className="text-[0.9375rem] text-muted-foreground">{children}</div>}
    </div>
  );
}

type Fact = { label: string; value: React.ReactNode };

/**
 * Полоса справочных сведений (телефон, режим, адрес): равные ячейки, подпись над значением обычного кегля.
 * В отличие от KeyFacts рассчитана на длинные значения. Пустые ячейки не выводятся.
 */
export function InfoStrip({ items, className }: { items: Fact[]; className?: string }) {
  const filled = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== false && item.value !== "");
  if (filled.length === 0) return null;
  return (
    <dl className={cn("grid gap-px overflow-hidden rounded-lg bg-border shadow-card md:grid-flow-col md:auto-cols-fr", className)}>
      {filled.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 bg-surface p-5">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-[1.0625rem] font-medium leading-snug">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Шаги настоящей последовательности: равные карточки с крупным номером. */
export function StepCards({ items, className }: { items: { title: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn("grid gap-4 sm:auto-rows-fr sm:grid-cols-2", items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4", className)}>
      {items.map((item, index) => (
        <li key={item.title} className="card flex h-full gap-4 p-5">
          <span className="text-3xl font-bold leading-none tabular-nums text-primary" aria-hidden>{index + 1}</span>
          <div className="min-w-0">
            <h3 className="text-[1.0625rem] font-semibold leading-snug">{item.title}</h3>
            <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Перечень коротких положений в одной карточке: строки разделены линией и делят высоту карточки поровну. */
export function PointList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("card flex h-full flex-col divide-y px-5 sm:px-6", className)}>
      {items.map((item, index) => <li key={index} className="flex flex-1 items-center py-3.5">{item}</li>)}
    </ul>
  );
}

/** Справочная таблица «название — пояснение» в одной карточке. */
export function TermList({ items, className }: { items: { label: React.ReactNode; text: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("card h-full divide-y px-5 sm:px-6", className)}>
      {items.map((item, index) => (
        <div key={index} className="grid gap-x-6 gap-y-0.5 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <dt className="font-medium">{item.label}</dt>
          <dd className="text-muted-foreground">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}
