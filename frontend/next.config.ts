import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
/** Backend API: файлы, превью и запросы браузера (админка, кабинет, ИИ). */
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
const apiOrigin = apiUrl.origin;
const siteIsHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * CSP. 'unsafe-inline' в script-src нужен App Router (инлайн-скрипты гидратации); nonce потребовал бы
 * динамического рендеринга всех страниц. Защита от XSS — экранирование React и санитизация HTML на
 * сервере; CSP ограничивает источники, запрещает плагины, фреймы и чужие формы.
 * Внешние источники: тайлы OSM (Leaflet) и геокодер Nominatim (построение маршрута).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin} https://tile.openstreetmap.org`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://nominatim.openstreetmap.org${isDev ? " ws: wss:" : ""}`,
  `media-src 'self' ${apiOrigin}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(siteIsHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Геолокация — только для «маршрута от меня» на карте филиалов.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS только для продакшена по HTTPS: на http://localhost заголовок бессмыслен и мешал бы разработке.
  ...(!isDev && siteIsHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // E2E собирает отдельную копию (другой NEXT_PUBLIC_API_URL), не трогая основной .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Оптимизатор next/image берёт только файлы и превью из API (права проверяет сам API).
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/api/files/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
