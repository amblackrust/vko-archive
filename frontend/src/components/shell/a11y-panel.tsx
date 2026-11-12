"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { ALargeSmall } from "lucide-react";
import clsx from "clsx";
import { IconButton } from "@/components/ui/icon-button";

type Prefs = { scale: number; contrast: boolean; motion: boolean };
const DEFAULTS: Prefs = { scale: 1, contrast: false, motion: false };
const SCALES = [1, 1.125, 1.25];

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("a11y") ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const root = document.documentElement;
  root.style.setProperty("--ui-scale", String(p.scale));
  if (p.contrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (p.motion) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
  try {
    localStorage.setItem("a11y", JSON.stringify(p));
  } catch {
    // Storage can be blocked; the choice then lasts for this page view only.
  }
  window.dispatchEvent(new Event("a11y-change"));
}

export function A11yPanel() {
  const t = useTranslations("common.a11y");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => setPrefs(load()), []);

  const update = (next: Prefs) => {
    setPrefs(next);
    apply(next);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton label={t("label")}>
          <ALargeSmall size={20} />
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="pop glassine z-50 w-72 rounded-3xl border border-frame p-4 shadow-lift-high">
          <p className="mb-2 text-sm text-ink-3">{t("fontSize")}</p>
          <div className="mb-4 flex gap-1.5">
            {SCALES.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={prefs.scale === s}
                onClick={() => update({ ...prefs, scale: s })}
                className={clsx(
                  "h-11 flex-1 rounded-2xl transition-[background-color,transform] active:scale-95",
                  prefs.scale === s ? "bg-ink text-paper" : "bg-mount-2 hover:bg-frame",
                )}
                style={{ fontSize: `${0.875 + i * 0.1875}rem` }}
              >
                A
              </button>
            ))}
          </div>
          {(["contrast", "motion"] as const).map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              <span>{t(key)}</span>
              <input type="checkbox" role="switch" checked={prefs[key]} onChange={(e) => update({ ...prefs, [key]: e.target.checked })} className="size-5" />
            </label>
          ))}
          <button type="button" onClick={() => update(DEFAULTS)} className="mt-2 text-sm text-ink-3 underline hover:text-ink">
            {t("reset")}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
