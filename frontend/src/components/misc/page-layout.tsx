import { LinkList } from "@/components/ui/link-list";
import { cn } from "@/lib/utils";

/** Тело информационной страницы под PageHeader: основная колонка и необязательная боковая. */
export function PageBody({ aside, className, children }: { aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("container-page grid gap-12 py-10 pb-16", aside && "lg:grid-cols-[minmax(0,1fr)_20rem]", className)}>
      <div className="min-w-0 space-y-12">{children}</div>
      {aside && <aside className="space-y-8 self-start lg:sticky lg:top-28">{aside}</aside>}
    </div>
  );
}

/** Смысловой блок страницы: заголовок второго уровня, пояснение и содержимое. `id` — якорь для ссылок. */
export function Block({ id, title, text, children }: { id: string; title: string; text?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 space-y-4">
      <div className="max-w-3xl space-y-2">
        <h2 id={`${id}-title`} className="text-2xl">{title}</h2>
        {text && <p className="text-muted-foreground">{text}</p>}
      </div>
      {children}
    </section>
  );
}

/** Боковой блок «куда дальше»: заголовок и список ссылок. */
export function SeeAlso({ title, items }: { title: string; items: React.ComponentProps<typeof LinkList>["items"] }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-3 text-base">{title}</h2>
      <LinkList items={items} />
    </nav>
  );
}

/** Оглавление страницы: якорные ссылки на её блоки. На узком экране — ряд кнопок над текстом, на широком — список в боковой колонке. */
export function PageToc({ title, items }: { title: string; items: { id: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-3 text-base">{title}</h2>
      <ul className="flex flex-wrap gap-2 text-[0.9375rem] lg:block lg:divide-y lg:rounded-lg lg:bg-surface lg:px-4 lg:shadow-card">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="flex min-h-11 items-center rounded-md border bg-surface px-3 py-2 hover:text-primary hover:underline lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Шаги по порядку (нумерация — потому что это действительно последовательность). */
export function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className="grid gap-6 sm:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.title} className="border-t-2 border-primary pt-4">
          <p className="text-sm font-semibold tabular-nums text-primary">{index + 1}</p>
          <h3 className="mt-1 text-base">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
        </li>
      ))}
    </ol>
  );
}
