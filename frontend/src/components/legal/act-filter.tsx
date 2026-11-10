import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { LEGAL_STATUSES } from "./api";

/** Поиск и фильтр по статусу: обычная GET-форма, без клиентского JS. */
export function LegalActFilter({ q, status }: { q: string; status: string }) {
  const t = useTranslations("legal.filter");
  const tStatus = useTranslations("legal.status");
  return (
    <form method="get" role="search" className="grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("q")}
        <input name="q" defaultValue={q} maxLength={200} className="h-10 rounded-md border bg-background px-3 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("status")}
        <select name="status" defaultValue={status} className="h-10 rounded-md border bg-background px-3 font-normal">
          <option value="">{t("all")}</option>
          {LEGAL_STATUSES.map((value) => (
            <option key={value} value={value}>{tStatus(value)}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="submit">{t("submit")}</Button>
        <Button asChild variant="ghost">
          <Link href="/legal">{t("reset")}</Link>
        </Button>
      </div>
    </form>
  );
}
