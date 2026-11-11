/**
 * Адрес API для браузера: ссылки на файлы и запросы из клиентских компонентов.
 * Пустая строка — «тот же адрес, что у сайта»: режим одного адреса, когда Next.js сам проксирует /api (см. next.config.ts).
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Адрес API для запросов. На сервере в режиме одного адреса — внутренний (API_PROXY_TARGET), иначе тот же, что у браузера. */
export const API_URL = typeof window === "undefined" ? process.env.API_PROXY_TARGET || PUBLIC_API_URL : PUBLIC_API_URL;
