"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./toast";
import { useApiError, type ErrorScope } from "./use-api-error";

/** Загрузка данных экрана: data / loading / error (готовый текст) / reload. Ответ устаревшего запроса отбрасывается. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[], scope?: ErrorScope) {
  const describe = useApiError(scope);
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

/** Значение поля поиска, применённое через паузу после ввода. */
export function useDebounced(value: string, ms = 300): string {
  const [applied, setApplied] = useState(value.trim());
  useEffect(() => {
    const timer = setTimeout(() => setApplied(value.trim()), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return applied;
}

/**
 * Одно асинхронное действие: ход выполнения, текст ошибки и сообщение об успехе (всплывающее).
 * `run` возвращает true при успехе; ошибка остаётся в `error`, пока действие не запустят снова.
 */
export function useAction(scope?: ErrorScope) {
  const describe = useApiError(scope);
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (caught) {
      setError(describe(caught));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}
