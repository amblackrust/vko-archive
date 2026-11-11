import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StateViewProps {
  title: string;
  description?: string;
  /** Кнопки/ссылки действий под текстом. */
  children?: React.ReactNode;
  className?: string;
  /** Заголовок страницы (h1) или блока внутри страницы (h2). */
  as?: "h1" | "h2";
}

/** Системное состояние: заголовок, пояснение и действия — по левому краю страницы, без декоративных значков. */
export function StateView({ title, description, children, className, as: Heading = "h1" }: StateViewProps) {
  const page = Heading === "h1";
  return (
    <div className={cn(page ? "container-page py-14" : "card p-6 sm:p-8", className)}>
      <Heading className={page ? "text-3xl sm:text-4xl" : "text-xl"}>{title}</Heading>
      {description && <p className={cn("mt-3 max-w-2xl text-muted-foreground", page && "text-lg")}>{description}</p>}
      {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
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
    <StateView title={t("title")} description={t("description")}>
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
    <StateView title={t("title")} description={t("description")} as={as}>
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
    <StateView title={t("title")} description={t("description")}>
      <HomeButton />
    </StateView>
  );
}

/** «Нет доступа» — закрытые материалы (серверная проверка прав остаётся на backend). */
export function ForbiddenState() {
  const t = useTranslations("states.forbidden");
  return (
    <StateView title={t("title")} description={t("description")}>
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
    <StateView title={t("title")} description={t("description")}>
      {onRetry && <Button onClick={onRetry}>{t("retry")}</Button>}
      <HomeButton />
      {digest && <p className="w-full text-xs text-muted-foreground">{t("code", { digest })}</p>}
    </StateView>
  );
}
