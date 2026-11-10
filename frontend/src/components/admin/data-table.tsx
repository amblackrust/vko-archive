"use client";

import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Notice } from "./notice";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading: boolean;
  /** Текст ошибки загрузки; вместе с onRetry показывает кнопку «Повторить». */
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
}

/** Таблица админки с состояниями: загрузка (скелетон), ошибка (повтор), пусто. На узком экране — горизонтальная прокрутка. */
export function DataTable<T>({ caption, columns, rows, rowKey, loading, error, onRetry, emptyText }: DataTableProps<T>) {
  const t = useTranslations("admin.common");
  if (error) {
    return (
      <Notice
        kind="error"
        action={
          onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t("retry")}
            </Button>
          )
        }
      >
        {error}
      </Notice>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-surface" aria-busy={loading}>
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("px-3 py-2 font-medium", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading && !rows
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => (
                <tr key={rowKey(row)} className={cn("align-top", loading && "opacity-60")}>
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-3 py-2", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {rows?.length === 0 && (
        <p className="flex items-center justify-center gap-2 px-3 py-10 text-muted-foreground">
          <Inbox className="size-5" aria-hidden />
          {emptyText ?? t("empty")}
        </p>
      )}
    </div>
  );
}
