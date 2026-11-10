import { Compass, FileX2, Lock, SearchX, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StateViewProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Кнопки/ссылки действий под текстом. */
  children?: React.ReactNode;
  className?: string;
  /** Заголовок страницы (h1) или блока внутри страницы (h2). */
  as?: "h1" | "h2";
}

/** Базовая карточка системного состояния; тексты передаёт вызывающий. */
export function StateView({ icon: Icon, title, description, children, className, as: Heading = "h1" }: StateViewProps) {
  return (
    <div className={cn("mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-muted text-primary">
        <Icon className="size-8" aria-hidden />
      </span>
      <Heading className="text-2xl font-semibold sm:text-3xl">{title}</Heading>
      {description && <p className="text-muted-foreground">{description}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

function HomeButton() {
  const t = useTranslations("states");
  return (
    <Button asChild variant="outline">
      <Link href="/">{t("toHome")}</Link>
    </Button>
  );
}

export function NotFoundState() {
  const t = useTranslations("states.notFound");
  return (
    <StateView icon={Compass} title={t("title")} description={t("description")}>
      <HomeButton />
    </StateView>
  );
}

interface EmptyStateProps {
  /** Ссылка сброса фильтров; если не задана, кнопка не показывается. */
  resetHref?: string;
  as?: "h1" | "h2";
}

/** «Ничего не найдено» — результаты поиска и каталога. */
export function EmptyState({ resetHref, as }: EmptyStateProps) {
  const t = useTranslations("states.empty");
  return (
    <StateView icon={SearchX} title={t("title")} description={t("description")} as={as} className="py-12">
      {resetHref && (
        <Button asChild variant="outline">
          <Link href={resetHref}>{t("reset")}</Link>
        </Button>
      )}
    </StateView>
  );
}

/** «Материал недоступен» — скрыт, снят с публикации. */
export function UnavailableState() {
  const t = useTranslations("states.unavailable");
  return (
    <StateView icon={FileX2} title={t("title")} description={t("description")}>
      <HomeButton />
    </StateView>
  );
}

/** «Нет доступа» — закрытые материалы (серверная проверка прав остаётся на backend). */
export function ForbiddenState() {
  const t = useTranslations("states.forbidden");
  return (
    <StateView icon={Lock} title={t("title")} description={t("description")}>
      <HomeButton />
    </StateView>
  );
}

interface ErrorStateProps {
  onRetry?: () => void;
  digest?: string;
}

export function ErrorState({ onRetry, digest }: ErrorStateProps) {
  const t = useTranslations("states.error");
  return (
    <StateView icon={TriangleAlert} title={t("title")} description={t("description")}>
      {onRetry && <Button onClick={onRetry}>{t("retry")}</Button>}
      <HomeButton />
      {digest && <p className="w-full text-xs text-muted-foreground">{t("code", { digest })}</p>}
    </StateView>
  );
}

/** Skeleton страницы: заголовок + карточки. Для loading.tsx. */
export function PageSkeleton() {
  const t = useTranslations("states.loading");
  return (
    <div role="status" aria-label={t("label")} className="container-page py-10">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
