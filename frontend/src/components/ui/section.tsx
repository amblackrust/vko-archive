import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

/** Блок страницы: заголовок, пояснение, ссылка на раздел и содержимое. `muted` — белая полоса во всю ширину. */
export function Section({ id, title, text, href, linkLabel, muted, children }: {
  id: string;
  title: string;
  text?: string;
  href?: string;
  linkLabel?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("py-10 lg:py-14", muted && "bg-surface")}>
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="max-w-2xl">
            <h2 id={id} className="text-2xl text-primary sm:text-[1.75rem]">{title}</h2>
            {text && <p className="mt-2 text-muted-foreground">{text}</p>}
          </div>
          {href && linkLabel && (
            <Link href={href} className="inline-flex min-h-10 shrink-0 items-center rounded-md bg-primary-soft px-4 text-[0.9375rem] font-semibold text-primary hover:bg-primary hover:text-primary-foreground">
              {linkLabel}
            </Link>
          )}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
