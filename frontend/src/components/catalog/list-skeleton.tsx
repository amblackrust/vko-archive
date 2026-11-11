import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Каркас страниц каталога и поиска на время загрузки: шапка и линованные строки, как у готовой страницы. */
export function ListSkeleton() {
  const t = useTranslations("states.loading");
  return (
    <div role="status" aria-label={t("label")} className="container-page py-10">
      <Skeleton className="h-9 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <div className="card mt-10 divide-y px-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[8rem_1fr_auto]">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="hidden h-5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
