"use client";

import { useCallback, useEffect, useState } from "react";
import { useApiError } from "./use-api-error";

/** Загрузка данных страницы: data / loading / error (готовый текст) / reload. Ранний ответ устаревшего запроса отбрасывается. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const describe = useApiError();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((caught) => !cancelled && setError(describe(caught)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // loader и describe пересоздаются каждый рендер; перезапуск — только по deps и reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, loading, error, reload };
}
