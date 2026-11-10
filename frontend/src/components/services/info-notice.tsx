import { Info } from "lucide-react";

/** Баннер «только информация»: на сайте не оформляются заявления, заказы и платежи. */
export function InfoNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm text-accent-soft-foreground">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
