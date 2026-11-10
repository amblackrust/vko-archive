import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // всё, кроме api, служебных путей Next и файлов со статическим расширением
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
