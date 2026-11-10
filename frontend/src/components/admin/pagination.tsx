"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const t = useTranslations("admin.common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{t("total", { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("prev")} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </Button>
        <span aria-live="polite">{t("pageOf", { page, pages })}</span>
        <Button variant="outline" size="icon" aria-label={t("next")} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
