"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Quote, Share2 } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";

export type Citation = { fund?: string; inventory?: string; case?: string; sheets?: number | null };

/** Archive-style reference built from what the card has; a missing part is skipped. */
export function DocActions({ code, citation }: { code: string | null; citation?: Citation }) {
  const t = useTranslations("document");
  const tc = useTranslations("document.cite");
  const archive = useTranslations("common")("siteName");
  const reference = citation
    ? [
        archive,
        citation.fund && `${tc("fund")} ${citation.fund}`,
        citation.inventory && `${tc("inventory")} ${citation.inventory}`,
        citation.case && `${tc("case")} ${citation.case}`,
        citation.sheets && `${tc("sheets")} ${citation.sheets}`,
      ]
        .filter(Boolean)
        .join(tc("join")) + "."
    : "";
  const [done, setDone] = useState<"code" | "link" | "cite" | null>(null);
  const flash = (k: "code" | "link" | "cite") => {
    setDone(k);
    setTimeout(() => setDone(null), 1600);
  };
  return (
    <>
      {code && (
        <Button variant="secondary" onClick={() => void navigator.clipboard?.writeText(code).then(() => flash("code"))}>
          {done === "code" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {done === "code" ? t("linkCopied") : t("copyCode")}
        </Button>
      )}
      {citation && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="secondary"><Quote size={16} aria-hidden /> {tc("button")}</Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={8} collisionPadding={12} className="pop z-[60] w-[min(26rem,calc(100vw-1.5rem))] rounded-2xl border border-frame bg-paper p-4 text-ink shadow-lift-high">
              <p className="select-all leading-relaxed">{reference}</p>
              <p className="mt-2 text-xs text-ink-3">{tc("hint")}</p>
              <Button size="sm" className="mt-3" onClick={() => void navigator.clipboard?.writeText(reference).then(() => flash("cite"))}>
                {done === "cite" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {done === "cite" ? tc("copied") : tc("copy")}
              </Button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      <Button
        variant="secondary"
        onClick={async () => {
          const url = window.location.href;
          if (navigator.share) await navigator.share({ url }).catch(() => undefined);
          else await navigator.clipboard?.writeText(url).then(() => flash("link"));
        }}
      >
        {done === "link" ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />} {done === "link" ? t("linkCopied") : t("share")}
      </Button>
    </>
  );
}
