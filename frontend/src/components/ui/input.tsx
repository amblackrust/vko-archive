import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-border-strong bg-surface px-3.5 text-[0.9375rem] placeholder:text-muted-foreground hover:border-primary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
