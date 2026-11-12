import clsx from "clsx";
import { useTranslations } from "next-intl";

const tones = {
  neutral: "bg-table-3 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  action: "bg-action-soft text-action",
  edge: "border border-edge/60 text-edge-text",
} as const;

export function Badge({ tone = "neutral", children, title, className }: { tone?: keyof typeof tones; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={clsx("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const ACCESS_TONE = { open: "ok", restricted: "warn", closed: "bad", needs_review: "neutral" } as const;

export function AccessBadge({ access }: { access: string }) {
  const t = useTranslations("dict.access");
  const tone = ACCESS_TONE[access as keyof typeof ACCESS_TONE] ?? "neutral";
  return <Badge tone={tone}>{t.has(access) ? t(access) : access}</Badge>;
}
