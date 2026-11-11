"use client";

/** Сортировка выдачи: поле формы каталога; с JS применяется сразу при выборе, без JS — кнопкой «Найти». */
export function SortSelect({ form, label, defaultValue, options }: {
  form: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        form={form}
        name="sort"
        defaultValue={defaultValue}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-md border bg-surface px-3 text-sm font-medium"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
