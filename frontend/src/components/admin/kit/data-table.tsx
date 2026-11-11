"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LoadError } from "./notice";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Главная колонка: на телефоне идёт первой, без подписи. */
  primary?: boolean;
  /** Колонка кнопок: на телефоне без подписи. */
  actions?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Текст ошибки загрузки; вместе с onRetry показывает кнопку «Повторить». */
  error?: string | null;
  onRetry?: () => void;
  /** Что показать вместо строк, когда список пуст (EmptyState). */
  empty?: React.ReactNode;
  pagination?: { page: number; pageSize: number; total: number; onPage: (page: number) => void };
  /** Класс отступа закреплённой шапки: под верхней панелью (по умолчанию) или у края окна. */
  stickyTop?: string;
}

/**
 * Таблица админки. Шапка закреплена при прокрутке; на телефоне строка складывается в блок: название,
 * под ним поля «подпись — значение» в две колонки и кнопки. Состояния: загрузка (скелетон), ошибка с повтором, пусто.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, loading = false, error, onRetry, empty, pagination, stickyTop = "top-14" }: DataTableProps<T>) {
  const t = useTranslations("admin.common");
  if (error) return <LoadError message={error} onRetry={onRetry} />;
  const ordered = [...columns].sort((a, b) => Number(b.primary ?? false) - Number(a.primary ?? false));
  const isEmpty = rows?.length === 0;
  return (
    <div className="card overflow-clip" aria-busy={loading}>
      {isEmpty ? (
        (empty ?? <p className="px-4 py-8 text-sm text-muted-foreground sm:px-6">{t("empty")}</p>)
      ) : (
        <table className="w-full text-left text-sm max-md:block">
          <caption className="sr-only">{caption}</caption>
          <thead className="max-md:sr-only">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn("sticky z-10 border-b bg-surface-muted px-4 py-3 text-[0.8125rem] font-semibold text-muted-foreground md:first:pl-6 md:last:pr-6", stickyTop, column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block">
            {rows === null
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} className="border-b last:border-0 max-md:block max-md:p-4">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 max-md:block max-md:px-0 max-md:py-1">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={rowKey(row)} className={cn("border-b transition-colors last:border-0 hover:bg-surface-muted/60 max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-2.5 max-md:p-4", loading && "opacity-60")}>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        style={{ order: ordered.indexOf(column) }}
                        className={cn("min-w-0 break-words px-4 py-3 align-top max-md:block max-md:p-0 md:first:pl-6 md:last:pr-6", (column.primary || column.actions) && "max-md:col-span-2", column.className)}
                      >
                        {!column.primary && !column.actions && <span className="block text-xs text-muted-foreground md:hidden">{column.header}</span>}
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      )}
      {pagination && !isEmpty && rows !== null && <TablePagination {...pagination} />}
    </div>
  );
}

function TablePagination({ page, pageSize, total, onPage }: NonNullable<DataTableProps<unknown>["pagination"]>) {
  const t = useTranslations("admin.common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-6">
      <span className="text-muted-foreground">{t("total", { count: total })}</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="w-9 rounded-full px-0" aria-label={t("prev")} disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
          </Button>
          <span aria-live="polite" className="tabular-nums">{t("pageOf", { page, pages })}</span>
          <Button variant="outline" size="sm" className="w-9 rounded-full px-0" aria-label={t("next")} disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}

/** Кнопка действия в строке: значок с подписью для экранного диктора и подсказкой при наведении. */
export function RowAction({ label, danger, className, children, ...props }: { label: string; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} className={cn("size-9", danger && "hover:bg-destructive-soft hover:text-destructive", className)} {...props}>
      {children}
    </Button>
  );
}

/** Название строки, открывающее запись: выглядит как ссылка, работает с клавиатуры. */
export function RowTitle({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn("break-words text-left font-semibold hover:text-primary hover:underline", className)} {...props} />;
}
