"use client";

import { useEffect, useState } from "react";
import { fetchRecommendations, type RecommendationQuery, type RecommendationsResponse } from "./api";

type State = { status: "idle" | "loading" | "error" } | { status: "done"; data: RecommendationsResponse };

/** Загружает рекомендации; `query = null` — ничего не запрашивать. */
export function useRecommendations(query: RecommendationQuery | null): State {
  const [state, setState] = useState<State>({ status: "idle" });
  const key = query ? JSON.stringify(query) : null;

  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchRecommendations(JSON.parse(key) as RecommendationQuery, controller.signal)
      .then((data) => setState({ status: "done", data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("recommendations failed", error);
          setState({ status: "error" });
        }
      });
    return () => controller.abort();
  }, [key]);

  return state;
}
