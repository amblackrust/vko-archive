import { Mail, Phone } from "lucide-react";
import { telHref } from "@/components/misc/contact-links";
import { cn } from "@/lib/utils";

const ICONS = { phone: Phone, mail: Mail } as const;

/**
 * Плитка контакта: подпись (чей это номер, что за адрес) и крупное значение. Телефон и почта — ссылки
 * `tel:` и `mailto:` на всю плитку, остальное — просто текст. В сетке с `auto-rows-fr` плитки равны по высоте.
 */
export function ContactTile({ label, value, kind, note, lang, className }: {
  label: string;
  value: string;
  /** phone и mail делают плитку ссылкой; без kind — справочное значение (адрес, руководитель, часы). */
  kind?: keyof typeof ICONS;
  note?: React.ReactNode;
  lang?: string;
  className?: string;
}) {
  const Icon = kind ? ICONS[kind] : null;
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        lang={lang}
        className={cn(
          "mt-auto flex items-start gap-2.5 font-semibold leading-snug",
          kind === "phone" ? "whitespace-nowrap text-xl tabular-nums" : kind === "mail" ? "break-all text-base sm:text-[1.0625rem]" : "text-[1.0625rem]",
          kind && "group-hover:text-primary",
        )}
      >
        {Icon && <Icon className={cn("size-[1.125rem] shrink-0 text-primary", kind === "phone" ? "mt-[0.3125rem]" : "mt-1")} aria-hidden />}
        {value}
      </span>
      {note}
    </>
  );
  const box = cn("card flex h-full min-h-24 flex-col gap-3 p-5 sm:min-h-28", className);
  return kind ? (
    <a href={kind === "phone" ? telHref(value) : `mailto:${value}`} className={cn(box, "lift group")}>{body}</a>
  ) : (
    <div className={box}>{body}</div>
  );
}
