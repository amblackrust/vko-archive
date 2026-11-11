import { Search } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { GetForm } from "./get-form";

/**
 * Входная часть списка (фонды, газеты, описи, дела, поиск по сайту): заголовок, пояснение и крупная строка поиска
 * в белой карточке — та же геометрия, что у баннера каталога, но без синего. Форма — GET, работает без JS.
 * `fields` — дополнительные поля той же формы в строке поиска (год), `children` — содержимое под формой.
 */
export function ListHero({ crumbs, title, lead, pathname, formId, formKey, formLabel, input, submit, fields, hidden, children }: {
  crumbs: Crumb[];
  title: string;
  lead?: string;
  pathname: string;
  /** id формы: к ней привязываются поля вне шапки (фильтры, сортировка) атрибутом `form`. */
  formId?: string;
  /** Текущие условия: при их смене поля формы получают значения из адреса заново. */
  formKey: string;
  formLabel: string;
  input: { id: string; label: string; placeholder?: string; value: string; maxLength?: number };
  submit: string;
  fields?: React.ReactNode;
  hidden?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header>
      <Breadcrumbs items={crumbs} />
      <div className="container-page pb-6">
        <div className="card rounded-3xl p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {lead && <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{lead}</p>}
          <GetForm key={formKey} id={formId} pathname={pathname} role="search" aria-label={formLabel} className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex h-14 min-w-0 flex-[1_1_20rem] items-center gap-2 rounded-2xl border border-border-strong bg-surface p-1.5 pl-4 transition-colors focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring sm:max-w-3xl">
              <label htmlFor={input.id} className="sr-only">{input.label}</label>
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                id={input.id}
                name="q"
                type="search"
                defaultValue={input.value}
                placeholder={input.placeholder}
                maxLength={input.maxLength ?? 200}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none"
              />
              <button type="submit" className="h-full shrink-0 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:px-7">{submit}</button>
            </div>
            {fields}
            {hidden}
          </GetForm>
          {children}
        </div>
      </div>
    </header>
  );
}

/** Короткое поле в строке поиска шапки (например, год): той же высоты, подпись — для экранного диктора и в подсказке. */
export function HeroField({ label, className, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <input
        {...props}
        title={label}
        className="h-14 w-full rounded-2xl border border-border-strong bg-surface px-4 text-base placeholder:text-muted-foreground hover:border-primary"
      />
    </label>
  );
}
