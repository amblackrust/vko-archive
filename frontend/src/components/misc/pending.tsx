import { Clock } from "lucide-react";

/** Пометка «данных пока нет»: значок и текст, чтобы статус читался не только по цвету. */
export function Pending({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
