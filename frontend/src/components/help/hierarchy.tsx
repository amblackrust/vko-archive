import { useTranslations } from "next-intl";

const LEVELS = ["archive", "fund", "inventory", "case", "document"] as const;

/**
 * Схема каталога «архив, фонд, опись, дело, документ» одной полосой равных ячеек: порядок слева направо
 * повторяет вложенность и то, как складывается шифр. На узком экране ячейки идут строками.
 */
export function Hierarchy({ label }: { label: string }) {
  const t = useTranslations("help.structure.levels");
  return (
    <ol aria-label={label} className="grid gap-px overflow-hidden rounded-lg bg-border shadow-card lg:grid-cols-5">
      {LEVELS.map((id) => (
        <li key={id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] content-start gap-x-4 gap-y-2 bg-surface p-5 lg:grid-cols-1">
          <p className="cipher font-bold text-primary lg:text-lg" lang="ru">{t(`${id}.example`)}</p>
          <div>
            <h3 className="text-[1.0625rem] font-semibold">{t(`${id}.label`)}</h3>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">{t(`${id}.text`)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
