import { ArrowUpRight, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { fileUrl } from "@/lib/api/document";
import { fileFormat, type LegalActItem } from "./api";

/** Документ плиткой: название, кем издан и строка «открыть файл» с форматом и объёмом. Вся плитка — ссылка на файл или публикацию. */
export function DocTile({ act }: { act: LegalActItem }) {
  const t = useTranslations("legal");
  const common = useTranslations("common");
  const format = act.file && fileFormat(act.file.mime);
  const details = act.file ? [format, act.file.pages && t("row.pages", { count: act.file.pages })].filter(Boolean).join(", ") : "";
  const body = (
    <>
      <span className="text-[1.0625rem] font-semibold leading-snug [text-wrap:pretty] group-hover:text-primary" lang={act.title_lang}>{act.title}</span>
      {act.issuer && <span className="mt-1.5 text-[0.9375rem] text-muted-foreground">{act.issuer}</span>}
    </>
  );
  const tile = "card group flex h-full flex-col p-5";
  if (act.file) {
    return (
      <a href={fileUrl(act.file.url)} className={`${tile} lift`}>
        {body}
        <span className="mt-auto flex items-center gap-2 pt-5 text-[0.9375rem] font-medium text-primary">
          <FileText className="size-4 shrink-0" aria-hidden />
          {t("row.file")}
          {details && <span className="font-normal text-muted-foreground">{details}</span>}
        </span>
      </a>
    );
  }
  if (act.adilet_url) {
    return (
      <a href={act.adilet_url} target="_blank" rel="noopener noreferrer" className={`${tile} lift`}>
        {body}
        <span className="mt-auto flex items-center gap-1.5 pt-5 text-[0.9375rem] font-medium text-primary">
          {t("row.adilet")}
          <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">({common("external")})</span>
        </span>
      </a>
    );
  }
  return <div className={tile}>{body}</div>;
}
