import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Row = { title: string; href: string; external?: boolean; note?: string };

/** Large link rows: the whole row is the target. */
export function LinkRows({ rows }: { rows: Row[] }) {
  return (
    <ul>
      {rows.map((r) => {
        const body = (
          <>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-medium tracking-[-0.025em] transition-colors group-hover:text-action md:text-3xl">{r.title}</span>
              {r.note && <span className="mt-1 block text-sm text-ink-3">{r.note}</span>}
            </span>
            <ArrowUpRight size={24} className="shrink-0 text-ink-3 transition-transform duration-300 ease-(--ease-spring) group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-action" aria-hidden />
          </>
        );
        const cls = "group -mx-4 flex items-center justify-between gap-6 rounded-2xl px-4 py-6 no-underline transition-colors hover:bg-table-2";
        return (
          <li key={r.href} className="border-b border-line first:border-t">
            {r.external ? <a href={r.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a> : <Link href={r.href} className={cls}>{body}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
