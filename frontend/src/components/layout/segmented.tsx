import { cn } from "@/lib/utils";

/** Переключатель из нескольких вариантов: подпись и ряд кнопок, выбранная залита. */
export function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-muted-foreground">{label}</legend>
      <div className="mt-1.5 flex gap-1 rounded-xl bg-surface-muted p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-2 text-sm font-medium transition-colors",
              value === option.value ? "bg-surface text-primary shadow-card" : "hover:text-primary",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
