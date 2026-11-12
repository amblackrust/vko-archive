"use client";

import { ArrowLeft, X } from "lucide-react";
import { motion } from "motion/react";
import { IconButton } from "@/components/ui/icon-button";

/** Rises from the bottom edge of the map while the map zooms in on the marker. */
export function DetailSheet({ children, onClose, backLabel }: { children: React.ReactNode; onClose: () => void; backLabel: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center px-0 md:px-6">
      <motion.section
        initial={{ y: "105%" }}
        animate={{ y: 0 }}
        exit={{ y: "105%" }}
        transition={{ type: "spring", visualDuration: 0.55, bounce: 0.12 }}
        className="glass pointer-events-auto max-h-[58dvh] w-full max-w-[60rem] overflow-y-auto rounded-t-[32px] border border-b-0 border-line p-6 shadow-lift-high md:p-8"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full bg-table-3 px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
            <ArrowLeft size={14} aria-hidden />{backLabel}
          </button>
          <IconButton label="×" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
      </motion.section>
    </div>
  );
}
