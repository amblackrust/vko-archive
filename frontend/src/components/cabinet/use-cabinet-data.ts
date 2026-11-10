"use client";

import { useCallback, useEffect, useState } from "react";
import { CabinetError, cabinetFetch } from "./api";
import { errorKey } from "./errors";

/** Загрузка списка кабинета + перезагрузка после изменений. `error` — ключ строки cabinet.* или null. */
export function useCabinetList<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await cabinetFetch<T>(path));
      setError(null);
    } catch (e) {
      setError(errorKey(e instanceof CabinetError ? e.code : "generic"));
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Выполняет изменение и перечитывает список; ошибка показывается в `error`. */
  const mutate = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (e) {
        setError(errorKey(e instanceof CabinetError ? e.code : "generic"));
        return;
      }
      await reload();
    },
    [reload],
  );

  return { data, error, mutate };
}
