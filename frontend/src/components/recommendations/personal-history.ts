"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Персональные рекомендации: переключатель и история просмотренных документов хранятся
 * только в localStorage этого браузера. На сервер история уходит лишь параметром `seen`
 * запроса рекомендаций и там не сохраняется. Выключение стирает историю.
 */
const ENABLED_KEY = "vko.recommendations.personal";
const HISTORY_KEY = "vko.recommendations.viewed";
const HISTORY_LIMIT = 20;
const CHANGE_EVENT = "vko-recommendations-change";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PersonalState {
  enabled: boolean;
  history: string[];
}

function read(): PersonalState {
  try {
    const enabled = window.localStorage.getItem(ENABLED_KEY) === "on";
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    const history = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && UUID_RE.test(id)) : [];
    return { enabled, history: enabled ? history.slice(0, HISTORY_LIMIT) : [] };
  } catch {
    // Хранилище недоступно (приватный режим, запрет cookies): работаем без персонализации.
    return { enabled: false, history: [] };
  }
}

function write(state: PersonalState) {
  try {
    window.localStorage.setItem(ENABLED_KEY, state.enabled ? "on" : "off");
    if (state.enabled) window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    else window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Не сохранилось — переключатель действует до перезагрузки страницы.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePersonalHistory() {
  const [state, setState] = useState<PersonalState>({ enabled: false, history: [] });

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    const next = { enabled, history: enabled ? read().history : [] };
    setState(next);
    write(next);
  }, []);

  /** Запомнить просмотр документа (только если персональные рекомендации включены). */
  const record = useCallback((documentId: string) => {
    const current = read();
    if (!current.enabled || !UUID_RE.test(documentId)) return;
    const next = { enabled: true, history: [documentId, ...current.history.filter((id) => id !== documentId)].slice(0, HISTORY_LIMIT) };
    setState(next);
    write(next);
  }, []);

  return { ...state, setEnabled, record };
}
