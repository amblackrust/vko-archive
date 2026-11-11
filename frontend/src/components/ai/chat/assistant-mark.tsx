import { cn } from "@/lib/utils";

/** Знак помощника: реплика с двумя строками текста — в геометрии логотипа, без «роботов». */
export function AssistantMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17h-6.4l-4.1 3.6V17H5a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 5 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7.5 9h9M7.5 12.5h5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** «Помощник печатает»: три точки; подпись читается экранным диктором. */
export function TypingDots({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
      <span className="inline-flex gap-1" aria-hidden>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      {label}
    </span>
  );
}
