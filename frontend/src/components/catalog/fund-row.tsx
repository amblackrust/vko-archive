import { useTranslations } from "next-intl";
import { DemoTag } from "@/components/ui/demo-tag";
import { RecordRow } from "@/components/ui/record-list";
import type { FundItem } from "@/lib/api/catalog";
import { enumLabel, fundYears } from "./labels";

/** Строка фонда в списке — как строка архивного справочника: номер, название, годы, объём. */
export function FundRow({ fund }: { fund: FundItem }) {
  const t = useTranslations("catalog");
  const earlier = fund.former_names.length - 1;
  const years = fundYears(t, fund);
  return (
    <RecordRow
      code={fund.number}
      codeColumn
      title={fund.title}
      href={fund.href}
      lang={fund.title_lang}
      meta={
        <>
          <span>{enumLabel(t, "fundTypes", fund.type)}</span>
          {earlier > 0 && <span>{t("funds.earlierNames", { count: earlier })}</span>}
          {fund.restricted === "partial" && <span>{t("funds.partial")}</span>}
          {fund.is_demo && <DemoTag />}
        </>
      }
      aside={
        <>
          {years && <span className="font-medium">{years}</span>}
          {fund.units_count !== null && <span className="text-muted-foreground">{t("funds.units", { count: fund.units_count })}</span>}
        </>
      }
    />
  );
}
