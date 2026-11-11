import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const LEVELS = ["archive", "fund", "inventory", "case", "document"] as const;

/** Один уровень схемы: рамка, внутри которой лежит следующий уровень. */
function Level({ index }: { index: number }) {
  const t = useTranslations("help.structure.levels");
  const id = LEVELS[index];
  return (
    <li className={cn("card p-3 sm:p-4", index % 2 ? "bg-surface-muted" : "bg-surface")}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="font-semibold">{t(`${id}.label`)}</span>
        <span className="cipher text-sm font-semibold text-primary">{t(`${id}.example`)}</span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{t(`${id}.text`)}</p>
      {index < LEVELS.length - 1 && (
        <ul className="mt-3">
          <Level index={index + 1} />
        </ul>
      )}
    </li>
  );
}

/** Схема каталога «архив → фонд → опись → дело → документ»: вложенные рамки показывают, что во что входит. */
export function Hierarchy({ label }: { label: string }) {
  return (
    <ul aria-label={label} className="max-w-3xl">
      <Level index={0} />
    </ul>
  );
}
