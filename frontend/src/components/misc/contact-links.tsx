import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/** Номера в данных архива записаны как «8 (7232) 25-59-76»: для tel: берём последние 10 цифр и код +7. */
export const telHref = (value: string) => `tel:+7${value.replace(/\D/g, "").slice(-10)}`;

const base = "inline-flex min-h-6 items-start gap-1.5 hover:text-primary hover:underline";

export function PhoneLink({ value, className }: { value: string; className?: string }) {
  return (
    <a href={telHref(value)} className={cn(base, "whitespace-nowrap tabular-nums", className)}>
      <Phone className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {value}
    </a>
  );
}

export function MailLink({ value, className }: { value: string; className?: string }) {
  return (
    <a href={`mailto:${value}`} className={cn(base, "break-all", className)}>
      <Mail className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {value}
    </a>
  );
}
