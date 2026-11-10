import { useTranslations } from "next-intl";

const LEVELS = ["archive", "fund", "inventory", "case", "document"] as const;

/** Иерархия каталога (ТЗ §5.4): каждый уровень вложен в предыдущий. Тексты — help.catalog.levels. */
export function CatalogStructure() {
  const t = useTranslations("help.catalog.levels");
  return (
    <ol className="space-y-3">
      {LEVELS.map((level, depth) => (
        <li key={level} className="flex gap-3" style={{ marginLeft: `${depth * 1.25}rem` }}>
          <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {depth + 1}
          </span>
          <div className="rounded-md border bg-surface p-3">
            <p className="font-semibold">{t(`${level}.label`)}</p>
            <p className="text-sm text-muted-foreground">{t(`${level}.text`)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
