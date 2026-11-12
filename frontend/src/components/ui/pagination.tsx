import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "./button";

type Props = { page: number; pages: number; basePath: string; params: Record<string, string | string[] | undefined> };

/** Server-rendered pager: plain links, so it works without JS and keeps filters in the URL. */
export async function Pagination({ page, pages, basePath, params }: Props) {
  if (pages <= 1) return null;
  const t = await getTranslations("dict.pagination");
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || v === undefined || v === "") continue;
      (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  return (
    <nav aria-label="pagination" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("secondary", "", "sm")}><ChevronLeft size={16} aria-hidden /> {t("prev")}</Link>
      ) : <span />}
      <p className="tnum text-sm text-ink-3">{t("page", { page, pages })}</p>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass("secondary", "", "sm")}>{t("next")} <ChevronRight size={16} aria-hidden /></Link>
      ) : <span />}
    </nav>
  );
}
