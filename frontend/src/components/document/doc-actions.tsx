"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocActions({ code }: { code: string | null }) {
  const t = useTranslations("document");
  const [done, setDone] = useState<"code" | "link" | null>(null);
  const flash = (k: "code" | "link") => {
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
