/** Шифр записи в шапке страницы: заметная плашка, длинный шифр переносится. */
export function CipherChip({ children }: { children: React.ReactNode }) {
  return <span className="cipher inline-block rounded-full bg-primary-soft px-3.5 py-1 font-semibold text-primary">{children}</span>;
}
