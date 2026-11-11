import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Краска: главное действие на экране. */
        primary: "caps bg-primary text-primary-foreground hover:bg-accent hover:text-white dark:hover:text-primary-foreground",
        /** Тонкая рамка краской: второстепенное действие. */
        outline: "caps border border-primary bg-transparent text-foreground hover:bg-primary hover:text-primary-foreground",
        /** Без рамки: действие в панели инструментов. */
        ghost: "hover:bg-surface-muted",
        link: "text-foreground underline decoration-1 underline-offset-4 hover:text-accent",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-14 px-7 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Отрисовать дочерний элемент (например, Link) со стилями кнопки. */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
