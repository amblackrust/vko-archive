"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const control = "w-full rounded-md border border-border-strong bg-surface px-3.5 text-[0.9375rem] placeholder:text-muted-foreground hover:border-primary disabled:opacity-50";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
}

/** Подпись, поле, подсказка и ошибка одним блоком. Потомок получает id и aria-атрибуты через функцию. */
export function FormField({ label, hint, error, required, className, children }: FieldProps & {
  required?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => React.ReactNode;
}) {
  const id = useId();
  const described = error || hint ? `${id}-msg` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span aria-hidden className="text-destructive"> *</span>}
      </label>
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {described && (
        <p id={described} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...props }: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <FormField label={label} hint={hint} error={error} required={props.required} className={className}>
      {(field) => <Input {...props} {...field} />}
    </FormField>
  );
}

export function SelectField({ label, hint, error, className, children, ...props }: FieldProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  return (
    <FormField label={label} hint={hint} error={error} required={props.required} className={className}>
      {(field) => <Select {...props} {...field}>{children}</Select>}
    </FormField>
  );
}

export function TextareaField({ label, hint, error, className, ...props }: FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  return (
    <FormField label={label} hint={hint} error={error} required={props.required} className={className}>
      {(field) => <Textarea {...props} {...field} />}
    </FormField>
  );
}

/** Нативный список в стиле полей ввода. Без видимой подписи нужен aria-label. */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(control, "py-2.5", className)} {...props} />;
}

/** Флажок с подписью и необязательным пояснением. */
export function Checkbox({ label, hint, className, ...props }: { label: React.ReactNode; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cn("flex items-start gap-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-[1.125rem] shrink-0 accent-primary" {...props} />
      <span>
        <span className={hint ? "font-medium" : undefined}>{label}</span>
        {hint && <span className="block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Группа связанных полей с общим заголовком (fieldset + legend). */
export function FieldGroup({ legend, hint, className, children }: { legend: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}
