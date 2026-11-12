import { forwardRef } from "react";
import clsx from "clsx";

export const iconButtonClass =
  "inline-grid size-10 place-items-center rounded-full text-ink-2 transition-[background-color,color,transform] duration-200 ease-(--ease-spring) hover:bg-mount-2 hover:text-ink active:scale-90 active:duration-75 aria-expanded:bg-mount-2 aria-expanded:text-ink";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string };

/** Round icon control. The label is the accessible name and the native tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={clsx(iconButtonClass, className)} {...rest}>
      {children}
    </button>
  );
});
