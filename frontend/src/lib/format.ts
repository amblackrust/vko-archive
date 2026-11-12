// Small shared formatters for archive values.
export function periodLabel(period: string, suffix: string): string {
  const m = /^(\d{3}0)s$/.exec(period);
  return m ? `${m[1]}${suffix}` : period;
}

/** Edge-code style shelf mark; falls back to fund/inventory/case numbers. */
export function shelfMark(code?: string | null): string {
  return code?.trim() || "—";
}

export function fileHref(path: string | null | undefined): string | undefined {
  return path ?? undefined;
}
