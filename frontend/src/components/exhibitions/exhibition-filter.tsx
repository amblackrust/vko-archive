import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

interface Props {
  q: string;
  theme: string;
  period: string;
  themes: string[];
  periods: string[];
}

/** Поиск, тема и период: обычная GET-форма без клиентского JS. */
export function ExhibitionFilter({ q, theme, period, themes, periods }: Props) {
  const t = useTranslations("exhibitions.filter");
  const tTheme = useTranslations("exhibitions.themes");
  const field = "h-10 rounded-md border bg-background px-3 font-normal";
  return (
    <form method="get" role="search" className="grid gap-3 rounded-lg border bg-surface p-4 md:grid-cols-[1fr_12rem_12rem_auto] md:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("q")}
        <input name="q" defaultValue={q} maxLength={200} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("theme")}
        <select name="theme" defaultValue={theme} className={field}>
          <option value="">{t("all")}</option>
          {themes.map((value) => (
            <option key={value} value={value}>{tTheme.has(value) ? tTheme(value) : value}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("period")}
        <select name="period" defaultValue={period} className={field}>
          <option value="">{t("all")}</option>
          {periods.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="submit">{t("submit")}</Button>
        <Button asChild variant="ghost">
          <Link href="/exhibitions">{t("reset")}</Link>
        </Button>
      </div>
    </form>
  );
}
