import clsx from "clsx";

/** A quiet frame around a picture. */
export function Sleeve({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("rounded-[22px] bg-mount-2 p-2", className)}>{children}</div>;
}
