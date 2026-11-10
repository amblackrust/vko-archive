"use client";

import { ErrorState } from "@/components/ui/state-view";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={reset} digest={error.digest} />;
}
