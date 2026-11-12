import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const backend = process.env.BACKEND_URL ?? "http://localhost:8000";

const config: NextConfig = {
  // Browser and server both talk to /api on this origin: session cookies are SameSite=Strict.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  poweredByHeader: false,
};

export default createNextIntlPlugin("./src/i18n/request.ts")(config);
