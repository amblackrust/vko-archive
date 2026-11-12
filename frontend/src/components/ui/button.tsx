import clsx from "clsx";
import { Link } from "@/i18n/navigation";

// The pressed state answers on pointer-down; release springs back through the transition.
const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 font-medium no-underline transition-[background-color,color,transform,box-shadow] duration-200 ease-(--ease-spring) active:scale-[0.96] active:duration-75 disabled:pointer-events-none disabled:opacity-50";
const variants = {
  primary: "bg-action text-action-ink hover:brightness-110",
  secondary: "bg-table-3 text-ink hover:brightness-95",
  outline: "border border-line-strong text-ink hover:bg-table-2",
  ghost: "text-ink-2 hover:bg-table-3 hover:text-ink",
  danger: "bg-bad text-action-ink hover:brightness-110",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = "md" | "sm" | "lg";
const sizes: Record<ButtonSize, string> = { sm: "h-9 px-4 text-sm", md: "", lg: "h-14 px-8 text-lg" };

export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return clsx(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className, size)} {...rest} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClass(variant, className, size)} {...rest} />;
}
