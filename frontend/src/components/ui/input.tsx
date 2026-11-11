import * as React from "react";
import { cn } from "@/lib/utils";

/** Поле ввода, вдавленное в бумагу. */
export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "well h-11 w-full rounded-md border-0 px-3.5 text-base placeholder:italic placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
