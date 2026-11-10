"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdminApiError, adminApi, setCsrfToken, setUnauthorizedHandler, type Me } from "@/lib/api/admin";

type Status = "loading" | "anonymous" | "authed";

interface AdminContextValue {
  status: Status;
  /** Задан только при status === "authed". */
  me: Me | null;
  /** Сессия закончилась сама (таймаут/401), а не по кнопке «Выйти». */
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Продлить сессию обычным (не фоновым) запросом. */
  extend: () => Promise<void>;
  /** Завершить локально, не дожидаясь ответа сервера (таймер неактивности). */
  expire: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminProvider>");
  return value;
}

/** Текущий пользователь; вызывать только внутри защищённой части (после входа). */
export function useMe(): Me {
  const { me } = useAdmin();
  if (!me) throw new Error("useMe outside of an authenticated admin page");
  return me;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [expired, setExpired] = useState(false);
  const statusRef = useRef<Status>("loading");

  const apply = useCallback((nextStatus: Status, nextMe: Me | null, wasExpired = false) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setMe(nextMe);
    setExpired(wasExpired);
    if (!nextMe) setCsrfToken(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => apply("anonymous", null, statusRef.current === "authed"));
    adminApi
      .me()
      .then((user) => apply("authed", user))
      .catch(() => apply("anonymous", null));
    return () => setUnauthorizedHandler(null);
  }, [apply]);

  const value = useMemo<AdminContextValue>(
    () => ({
      status,
      me,
      expired,
      login: async (email, password) => apply("authed", await adminApi.login(email, password)),
      logout: async () => {
        try {
          await adminApi.logout();
        } catch (error) {
          // Сессия уже недействительна — выходим в любом случае; остальные ошибки показываем.
          if (!(error instanceof AdminApiError && error.status === 401)) throw error;
        }
        apply("anonymous", null);
      },
      extend: async () => {
        await adminApi.me();
      },
      expire: () => apply("anonymous", null, true),
    }),
    [status, me, expired, apply],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
