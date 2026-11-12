"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError, type Schema } from "@/lib/api/client";

type Gsi = {
  accounts: { id: { initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } };
};
declare global {
  interface Window {
    google?: Gsi;
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";

/** Google's own sign-in button. It renders only when the backend has a GOOGLE_CLIENT_ID. */
export function GoogleButton({ onSession, onError }: { onSession: (me: Schema["VisitorMe"]) => void; onError: (status: number) => void }) {
  const locale = useLocale();
  const t = useTranslations("cabinet");
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const cfg = useQuery({ queryKey: ["google-config"], staleTime: Infinity, queryFn: () => api.get<Schema["GoogleConfig"]>("/api/cabinet/auth/google/config", { scope: "visitor" }) });
  const clientId = cfg.data?.client_id;

  useEffect(() => {
    if (!clientId) return;
    if (window.google) return setReady(true);
    const s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`) ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    s.addEventListener("load", () => setReady(true));
    if (!s.isConnected) document.head.appendChild(s);
  }, [clientId]);

  useEffect(() => {
    if (!ready || !clientId || !box.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        try {
          onSession(await api.post<Schema["VisitorMe"]>("/api/cabinet/auth/google", { body: { credential }, scope: "visitor" }));
        } catch (err) {
          onError(err instanceof ApiError ? err.status : 0);
        }
      },
    });
    window.google.accounts.id.renderButton(box.current, { theme: "outline", size: "large", shape: "pill", width: 360, locale, text: "continue_with" });
  }, [ready, clientId, locale, onSession, onError]);

  if (!clientId) return null;
  return (
    <>
      <div ref={box} className="flex min-h-11 justify-center" />
      <p className="my-5 flex items-center gap-3 text-sm text-ink-3"><span className="h-px flex-1 bg-line" />{t("or")}<span className="h-px flex-1 bg-line" /></p>
    </>
  );
}
