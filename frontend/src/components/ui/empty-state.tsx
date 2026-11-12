import clsx from "clsx";

/** Quiet empty state: a statement and, when useful, the next step. */
export function EmptyState({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-3xl border border-dashed border-line-strong px-8 py-14 text-center", className)}>
      <p className="font-display text-2xl font-medium tracking-[-0.02em]">{title}</p>
      {children && <div className="mx-auto mt-3 max-w-[52ch] text-ink-2">{children}</div>}
    </div>
  );
}
