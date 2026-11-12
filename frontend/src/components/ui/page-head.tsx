import clsx from "clsx";
import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, light }: { items: Crumb[]; light?: boolean }) {
  if (!items.length) return null;
  return (
    <nav aria-label="breadcrumb" className={clsx("mb-4 text-sm", light ? "text-white/80" : "text-ink-3")}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={light ? "text-white/40" : "text-line-strong"}>/</span>}
            {c.href ? <Link href={c.href} className={clsx("no-underline hover:underline", light ? "hover:text-white" : "hover:text-ink")}>{c.label}</Link> : <span aria-current="page" className={light ? "text-white" : "text-ink-2"}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type Props = { title: string; lead?: string; crumbs?: Crumb[]; actions?: React.ReactNode; meta?: React.ReactNode; className?: string };

/** Page title row: heading left, actions right, full width. */
export function PageHead({ title, lead, crumbs, actions, meta, className }: Props) {
  return (
    <header className={clsx("wrap pb-8 pt-10 md:pt-14", className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0 max-w-[60rem]">
          <h1 className="text-[clamp(2.25rem,5vw,4rem)] tracking-[-0.035em]">{title}</h1>
          {lead && <p className="mt-4 max-w-[62ch] text-lg text-ink-2">{lead}</p>}
          {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
