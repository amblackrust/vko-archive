"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, buildUrl, type Schema } from "@/lib/api/client";

export type AiMeta = { mode?: Schema["AiAnswer"]["mode"]; filters?: Schema["AppliedFilters"] | null; parsed?: Schema["ParsedQuery"] | null };
type AiEvent = ({ type: "meta" } & AiMeta) | { type: "delta"; text: string } | { type: "done"; result: Schema["AiAnswer"] };

export type AiState = {
  status: "idle" | "loading" | "streaming" | "done" | "error";
  text: string;
  meta: AiMeta | null;
  result: Schema["AiAnswer"] | null;
  error: "limit" | "unavailable" | null;
};

const IDLE: AiState = { status: "idle", text: "", meta: null, result: null, error: null };

/** Reads the backend's NDJSON answer stream: meta → delta* → done. */
export function useAiStream() {
  const [state, setState] = useState<AiState>(IDLE);
  const ctl = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    ctl.current?.abort();
    setState((s) => (s.status === "streaming" || s.status === "loading" ? { ...s, status: "done" } : s));
  }, []);

  const reset = useCallback(() => {
    ctl.current?.abort();
    setState(IDLE);
  }, []);

  const run = useCallback(async (path: string, body: { q: string; lang: string; history?: { role: "user" | "assistant"; text: string }[]; page?: { path: string; title: string; text: string } }) => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setState({ ...IDLE, status: "loading" });
    try {
      const res = await fetch(buildUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify(body),
        credentials: "include",
        signal: c.signal,
      });
      if (!res.ok || !res.body) throw new ApiError(res.status, null);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as AiEvent;
          if (ev.type === "meta") setState((s) => ({ ...s, status: "streaming", meta: ev }));
          else if (ev.type === "delta") setState((s) => ({ ...s, status: "streaming", text: s.text + ev.text }));
          else if (ev.type === "done") setState((s) => ({ ...s, status: "done", result: ev.result, text: ev.result.answer || s.text }));
        }
      }
    } catch (e) {
      if (c.signal.aborted) return;
      setState({ ...IDLE, status: "error", error: e instanceof ApiError && e.status === 429 ? "limit" : "unavailable" });
    }
  }, []);

  return { state, run, stop, reset };
}
