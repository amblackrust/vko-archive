"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { Fragment } from "react";

export type Option = { value: string; label: string; count?: number };

type Props = {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  className?: string;
};

/** A rounded dropdown in the site's style: pill trigger, soft popover, check marks. */
export function Dropdown({ label, options, value, onChange, multiple = true, className }: Props) {
  const active = options.filter((o) => value.includes(o.value));
  const shown = !multiple && active[0] ? active[0].label : label;
  const toggle = (v: string) => {
    if (!multiple) return onChange([v]);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <Popover.Root>
      <Popover.Trigger
        className={clsx(
          "group inline-flex h-11 w-full items-center justify-between gap-2 rounded-full border px-4 text-left font-medium transition-[border-color,background-color,color,transform] duration-200 ease-(--ease-spring) hover:border-action active:scale-[0.98] data-[state=open]:border-action data-[state=open]:bg-action-soft",
          multiple && value.length ? "border-action bg-action-soft text-action" : "border-frame-strong bg-paper",
          className,
        )}
      >
        <span className="truncate">{shown}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {multiple && value.length > 0 && <span className="tnum grid size-5 place-items-center rounded-full bg-action text-xs font-bold text-action-ink">{value.length}</span>}
          <ChevronDown size={16} className="transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} collisionPadding={12} className="pop z-50 max-h-80 min-w-[var(--radix-popover-trigger-width)] max-w-[22rem] overflow-y-auto rounded-2xl border border-frame bg-paper p-1.5 shadow-lift-high">
          {options.length === 0 && <p className="px-3 py-2 text-ink-3">—</p>}
          {options.map((o) => {
            const on = value.includes(o.value);
            const Wrap = multiple ? Fragment : Popover.Close;
            return (
              <Wrap key={o.value} {...(multiple ? {} : { asChild: true })}>
              <button
                type="button"
                role={multiple ? "menuitemcheckbox" : "menuitemradio"}
                aria-checked={on}
                onClick={() => toggle(o.value)}
                className={clsx("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-mount-2", on && "font-semibold text-action")}
              >
                <span className={clsx("grid size-5 shrink-0 place-items-center rounded-md border transition-colors", on ? "border-action bg-action text-action-ink" : "border-frame-strong")}>{on && <Check size={13} strokeWidth={3} aria-hidden />}</span>
                <span className="flex-1">{o.label}</span>
                {o.count !== undefined && <span className="tnum text-sm text-ink-3">{o.count}</span>}
              </button>
              </Wrap>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
