"use client";

import { StateHelp } from "@/components/misc/state-help";
import { ErrorState } from "@/components/ui/state-view";

/** Сбой при отрисовке страницы: повтор, а ниже — поиск и разделы, которые продолжают работать. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <ErrorState onRetry={reset} digest={error.digest} />
      <StateHelp />
    </>
  );
}
