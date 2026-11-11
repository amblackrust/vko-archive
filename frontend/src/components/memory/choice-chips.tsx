import { Check } from "lucide-react";

/**
 * Выбор одного значения «чипами». Внутри настоящие радиокнопки: стрелки переключают варианты,
 * Tab проходит группу за один шаг, экранный диктор называет число вариантов. Значение "" — «все».
 */
export function ChoiceChips({ legend, name, options, value, onChange, className }: {
  legend: string;
  name: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border bg-surface px-4 py-1.5 text-[0.9375rem] font-medium hover:border-primary has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} className="peer sr-only" />
            {/* Галочка: выбранный вариант отличается не только цветом. */}
            <Check className="hidden size-4 peer-checked:block" aria-hidden />
            {option.label}
            {option.count != null && <span className="font-normal tabular-nums opacity-80">{option.count}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
