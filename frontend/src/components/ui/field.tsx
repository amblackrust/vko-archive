import { cn } from "@/lib/utils";
import { Input } from "./input";

const control = "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-base hover:border-foreground";

/** Подписанное поле ввода для GET-форм поиска и фильтров (работает без JS). */
export function Field({ label, className, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>
      <Input {...props} className="h-11 text-base" />
    </label>
  );
}

/** Подписанный выпадающий список. */
export function SelectField({ label, options, className, ...props }: {
  label: string;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>
      <select {...props} className={control}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
